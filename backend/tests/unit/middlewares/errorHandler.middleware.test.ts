import express from "express";
import request from "supertest";
import errorHandler from "../../../src/middlewares/errorHandler.middleware.js";
import { APIError, ValidationError } from "../../../src/utils/apiResponse.js";

const createErrorApp = (error: Error) => {
  const app = express();
  app.get("/error", (_req, _res, next) => next(error));
  app.use(errorHandler);
  return app;
};

describe("errorHandler", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("maps validation errors to 400", async () => {
    const res = await request(createErrorApp(
      new ValidationError("Validation failed", { email: ["Invalid email"] }),
    )).get("/error");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: { email: ["Invalid email"] },
    });
  });

  it.each([
    [401, "Authentication error"],
    [403, "Authorization error"],
    [404, "Resource not found"],
    [409, "Conflict"],
  ])("maps APIError %i", async (statusCode, message) => {
    const res = await request(createErrorApp(
      new APIError(statusCode, message, {}, "TEST_ERROR"),
    )).get("/error");

    expect(res.status).toBe(statusCode);
    expect(res.body).toMatchObject({
      success: false,
      message,
      errorCode: "TEST_ERROR",
    });
  });

  it("does not expose raw unknown errors in production", async () => {
    process.env.NODE_ENV = "production";

    const res = await request(createErrorApp(
      new Error("database password leaked at C:\\internal\\file.ts"),
    )).get("/error");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      message: "Internal server error",
    });
    expect(JSON.stringify(res.body)).not.toContain("database password");
    expect(JSON.stringify(res.body)).not.toContain("C:\\internal");
    expect(res.body).not.toHaveProperty("debug");
  });
});
