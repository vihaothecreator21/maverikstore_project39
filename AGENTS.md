# AGENTS.md

## Project summary
Maverik Store là project ecommerce fullstack cho thời trang/quần áo.

- Frontend: Vite, Bootstrap, Sass, static HTML trong `src`.
- Backend: Express + TypeScript trong `backend/src`.
- Database: Prisma schema tại `backend/prisma/schema.prisma`.
- Integrations quan trọng: Supabase, VNPAY, JWT/auth, Google Generative AI.

## Important folders
- `src`: frontend pages/assets/styles.
- `src/admin`: admin dashboard pages.
- `src/assets`: frontend assets.
- `docs/agents`: AI agent examples, skills, and safe-edit guidance.
- `docs/context`: longer AI/project context documents.
- `docs/architecture`: architecture and business-logic summaries.
- `docs/plans`: feature plans and implementation notes.
- `backend/src`: backend API source code.
- `backend/src/controllers`: HTTP controllers.
- `backend/src/routes`: API routes.
- `backend/src/services`: business logic.
- `backend/src/repositories`: data access layer.
- `backend/src/middlewares`: Express middlewares.
- `backend/src/schemas`: validation schemas.
- `backend/src/config`: backend configuration.
- `backend/src/gateways`: external/payment gateway integrations.
- `backend/src/jobs`: background jobs.
- `backend/prisma/schema.prisma`: database schema.
- `backend/prisma/migrations`: Prisma migrations.
- `backend/prisma/seed.ts`: seed data.
- `backend/tests`: backend tests.
- `backend/scripts`: backend utility/migration scripts.

## Do not read unless needed
- `node_modules`
- `backend/node_modules`
- `.next`
- `dist`
- `backend/dist`
- `build`
- `coverage`
- `logs`
- `public/uploads`
- `backend/prisma/migrations`

## Rules for Codex
- Không scan toàn bộ repo nếu task chỉ liên quan 1 module.
- Trước khi sửa code, hãy xác định file liên quan.
- Chỉ mở file cần thiết.
- Sau khi sửa, tóm tắt file đã sửa và lý do.
- Không refactor lan rộng nếu user không yêu cầu.
- Không đổi database schema nếu chưa hỏi.
- Không chạm payment/auth nếu task không liên quan.
- Với frontend, ưu tiên kiểm tra file HTML/SCSS/assets trong `src`.
- Với backend, ưu tiên luồng `routes -> controllers -> services -> repositories`.
- Với Prisma, schema nằm ở `backend/prisma/schema.prisma`, không phải root `prisma/schema.prisma`.

## Related docs
- `docs/README.md`: documentation index.
- `docs/agents/CODEX_SAFE_EDIT_EXAMPLES.md`: concrete examples for safe Codex edits.
- `docs/context/AI_ARCHITECTURE_CONTEXT.md`: extended AI context.
- `docs/architecture/PROJECT_LOGIC_SUMMARY.md`: core architecture and business logic notes.
- `docs/plans/EMAIL_OTP_REGISTRATION_PLAN.md`: email OTP registration plan.

## Do-not-break-project protocol
- Áp dụng tinh thần `karpathy-guidelines`: nghĩ trước khi code, sửa tối thiểu, nêu giả định, có tiêu chí verify rõ.
- Trước khi edit, liệt kê ngắn file sẽ inspect/edit và lý do nếu task có rủi ro hoặc chạm nhiều module.
- Mỗi dòng sửa phải trace được về yêu cầu của user. Nếu không giải thích được vì sao cần sửa dòng đó, đừng sửa.
- Không "dọn dẹp", đổi format, đổi tên biến, đổi style, đổi kiến trúc hoặc xóa dead code ngoài phạm vi task.
- Không thêm abstraction/config/helper mới cho một use case đơn lẻ.
- Không thay đổi API contract, response shape, localStorage key, env var, route path, Prisma model, enum, order/payment status nếu user không yêu cầu rõ.
- Không thay đổi auth, payment, order, stock, schema, migration, env validation nếu task không trực tiếp liên quan.
- Nếu thấy bug hoặc code thừa ngoài phạm vi, báo lại trong summary; không tự sửa.
- Nếu task mơ hồ, hỏi lại hoặc nêu assumption trước khi làm. Không đoán âm thầm.
- Với file đang dirty hoặc có thay đổi lạ, đọc kỹ và làm việc cùng thay đổi đó; không revert/reset.
- Sau khi sửa, chạy verify nhỏ nhất phù hợp: build frontend, test backend liên quan, hoặc ít nhất syntax/import check.
- Nếu không chạy được verify, phải nói rõ lý do.

## Safe edit checklist
1. Đọc `AGENTS.md` và `PROJECT_CONTEXT.md`.
2. Xác định module liên quan.
3. Inspect file tối thiểu.
4. Nêu assumption nếu có.
5. Sửa nhỏ nhất.
6. Xóa chỉ phần orphan do chính thay đổi vừa tạo.
7. Verify.
8. Tóm tắt file đã sửa, lý do, kết quả verify.

## Vietnamese / Encoding rules
- Ưu tiên viết comment, tài liệu, nội dung UI bằng tiếng Việt có dấu khi user yêu cầu tiếng Việt.
- Tất cả file text/code/docs phải giữ UTF-8.
- Không tự chuyển tiếng Việt có dấu sang không dấu, trừ khi user yêu cầu.
- Nếu terminal PowerShell hiển thị chữ Việt bị lỗi dạng `KhĂ´ng`, coi đó là lỗi hiển thị encoding của terminal trước; kiểm tra file bằng editor/UTF-8 hoặc công cụ đọc phù hợp trước khi kết luận file hỏng.
- Khi tạo/chỉnh DOCX, Markdown, HTML, JS comment: dùng tiếng Việt có dấu rõ ràng, dễ đọc cho backend engineer.
