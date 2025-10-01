import { Router } from "express";
import multer from "multer";
import { authGuard, AuthedRequest } from "../middleware/auth";
import {
  deleteFile,
  getFile,
  listFiles,
  saveFile,
  updateFile,
} from "../services/file";

const router = Router();
const upload = multer();

// /file/upload [POST]
router.post(
  "/file/upload",
  authGuard,
  upload.single("file"),
  (req: AuthedRequest, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ message: "file обязателен" });
    const rec = saveFile(req.user!.id, f.originalname, f.mimetype, f.buffer);
    return res.status(201).json(rec);
  }
);

// /file/list [GET]
router.get("/file/list", authGuard, (req: AuthedRequest, res) => {
  const rawPageSize = Number.parseInt(String(req.query.list_size), 10);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.isNaN(rawPageSize) ? 10 : rawPageSize)
  );
  const rawPage = Number.parseInt(String(req.query.page), 10);
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const result = listFiles(req.user!.id, page, pageSize);
  return res.json(result);
});

// /file/delete/:id [DELETE]
router.delete("/file/delete/:id", authGuard, (req: AuthedRequest, res) => {
  const ok = deleteFile(req.user!.id, req.params.id);
  return res.json({ ok });
});

// /file/:id [GET]
router.get("/file/:id", authGuard, (req: AuthedRequest, res) => {
  const rec = getFile(req.user!.id, req.params.id);
  if (!rec) return res.status(404).json({ message: "not found" });
  return res.json(rec);
});

// /file/download/:id [GET]
router.get("/file/download/:id", authGuard, (req: AuthedRequest, res) => {
  const rec = getFile(req.user!.id, req.params.id);
  if (!rec) return res.status(404).json({ message: "not found" });
  res.setHeader("Content-Type", rec.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${rec.name}"`);
  return res.sendFile(rec.path);
});

// /file/update/:id [PUT]
router.put(
  "/file/update/:id",
  authGuard,
  upload.single("file"),
  (req: AuthedRequest, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ message: "file is required" });
    const rec = updateFile(
      req.user!.id,
      req.params.id,
      f.originalname,
      f.mimetype,
      f.buffer
    );
    if (!rec) return res.status(404).json({ message: "not found" });
    return res.json(rec);
  }
);

export default router;
