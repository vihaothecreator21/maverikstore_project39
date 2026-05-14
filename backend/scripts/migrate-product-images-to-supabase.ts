import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

type ImageJob =
  | {
      type: "product";
      id: number;
      productId: number;
      oldUrl: string;
    }
  | {
      type: "productImage";
      id: number;
      productId: number;
      oldUrl: string;
    };

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const apply = args.has("--apply");
const dryRun = !apply || args.has("--dry-run");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
}

if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  throw new Error("--limit must be a positive integer");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

const isOnlineUrl = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const isSupabaseUrl = (value: string): boolean =>
  value.includes(".supabase.co/storage/v1/object/");

const contentTypeToExt = (contentType: string | undefined, fallbackUrl: string): string => {
  const cleanType = contentType?.split(";")[0]?.trim().toLowerCase();

  if (cleanType === "image/jpeg" || cleanType === "image/jpg") return "jpg";
  if (cleanType === "image/png") return "png";
  if (cleanType === "image/webp") return "webp";
  if (cleanType === "image/gif") return "gif";
  if (cleanType === "image/avif") return "avif";

  const parsedPath = new URL(fallbackUrl).pathname;
  const ext = path.extname(parsedPath).replace(".", "").toLowerCase();
  return ext || "jpg";
};

const objectPathFor = (job: ImageJob, buffer: Buffer, ext: string): string => {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  if (job.type === "product") {
    return `products/${job.productId}/main-${hash}.${ext}`;
  }

  return `products/${job.productId}/images/${job.id}-${hash}.${ext}`;
};

const downloadImage = async (url: string): Promise<{ buffer: Buffer; contentType?: string }> => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30_000,
    maxContentLength: 20 * 1024 * 1024,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const contentType = response.headers["content-type"];
  return {
    buffer: Buffer.from(response.data),
    contentType: Array.isArray(contentType) ? contentType[0] : contentType,
  };
};

const updateDatabase = async (job: ImageJob, newUrl: string): Promise<void> => {
  if (job.type === "product") {
    await prisma.product.update({
      where: { id: job.id },
      data: { imageUrl: newUrl },
    });
    return;
  }

  await prisma.productImage.update({
    where: { id: job.id },
    data: { url: newUrl },
  });
};

const loadJobs = async (): Promise<ImageJob[]> => {
  const [products, productImages] = await Promise.all([
    prisma.product.findMany({
      where: { imageUrl: { startsWith: "http" } },
      select: { id: true, imageUrl: true },
      orderBy: { id: "asc" },
    }),
    prisma.productImage.findMany({
      where: { url: { startsWith: "http" } },
      select: { id: true, productId: true, url: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const jobs: ImageJob[] = [
    ...products
      .filter((product) => isOnlineUrl(product.imageUrl) && !isSupabaseUrl(product.imageUrl))
      .map((product) => ({
        type: "product" as const,
        id: product.id,
        productId: product.id,
        oldUrl: product.imageUrl as string,
      })),
    ...productImages
      .filter((image) => isOnlineUrl(image.url) && !isSupabaseUrl(image.url))
      .map((image) => ({
        type: "productImage" as const,
        id: image.id,
        productId: image.productId,
        oldUrl: image.url,
      })),
  ];

  return limit ? jobs.slice(0, limit) : jobs;
};

const migrate = async (): Promise<void> => {
  const jobs = await loadJobs();
  const downloadCache = new Map<string, { buffer: Buffer; contentType?: string }>();

  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Jobs: ${jobs.length}`);

  let uploaded = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const downloaded = downloadCache.get(job.oldUrl) ?? (await downloadImage(job.oldUrl));
      downloadCache.set(job.oldUrl, downloaded);

      const ext = contentTypeToExt(downloaded.contentType, job.oldUrl);
      const objectPath = objectPathFor(job, downloaded.buffer, ext);
      const contentType = downloaded.contentType || `image/${ext === "jpg" ? "jpeg" : ext}`;

      if (dryRun) {
        console.log(`[dry-run] ${job.type}#${job.id}: ${job.oldUrl} -> ${objectPath}`);
        skipped += 1;
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, downloaded.buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploaded += 1;

      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      await updateDatabase(job, data.publicUrl);
      updated += 1;

      console.log(`[ok] ${job.type}#${job.id}: ${data.publicUrl}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[failed] ${job.type}#${job.id}: ${job.oldUrl} (${message})`);
    }
  }

  console.log("Done");
  console.log({ uploaded, updated, skipped, failed });
};

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
