import db from "../db";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export interface FileRecord {
  id: string;
  user_id: string;
  name: string;
  extension: string | null;
  mime_type: string | null;
  size: number;
  uploaded_at: number;
  path: string;
}

export function saveFile(
  userId: string,
  originalName: string,
  mimeType: string | undefined,
  buffer: Buffer
): FileRecord {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const ext = path.extname(originalName)?.replace(/^\./, "") || null;
  const storedName = id + (ext ? `.${ext}` : "");
  const filePath = path.join(UPLOAD_DIR, storedName);
  fs.writeFileSync(filePath, buffer);

  const rec: Omit<FileRecord, "id"> = {
    user_id: userId,
    name: originalName,
    extension: ext,
    mime_type: mimeType || null,
    size: buffer.length,
    uploaded_at: Date.now(),
    path: filePath,
  };
  db.prepare(
    "INSERT INTO files (id, user_id, name, extension, mime_type, size, uploaded_at, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    rec.user_id,
    rec.name,
    rec.extension,
    rec.mime_type,
    rec.size,
    rec.uploaded_at,
    rec.path
  );

  return { id, ...rec };
}

export function listFiles(userId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      "SELECT * FROM files WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?"
    )
    .all(userId, pageSize, offset) as FileRecord[];
  const total = (
    db
      .prepare("SELECT COUNT(1) as c FROM files WHERE user_id = ?")
      .get(userId) as any
  ).c as number;
  return {
    items: rows,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export function getFile(userId: string, id: string): FileRecord | null {
  const row = db
    .prepare("SELECT * FROM files WHERE id = ? AND user_id = ?")
    .get(id, userId) as FileRecord | undefined;
  return row || null;
}

export function deleteFile(userId: string, id: string): boolean {
  const rec = getFile(userId, id);
  if (!rec) return false;
  try {
    if (fs.existsSync(rec.path)) fs.unlinkSync(rec.path);
  } catch {}
  const info = db
    .prepare("DELETE FROM files WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return info.changes > 0;
}

export function updateFile(
  userId: string,
  id: string,
  originalName: string,
  mimeType: string | undefined,
  buffer: Buffer
): FileRecord | null {
  const rec = getFile(userId, id);
  if (!rec) return null;
  try {
    if (fs.existsSync(rec.path)) fs.unlinkSync(rec.path);
  } catch {}

  const ext = path.extname(originalName)?.replace(/^\./, "") || null;
  const storedName = id + (ext ? `.${ext}` : "");
  const filePath = path.join(UPLOAD_DIR, storedName);
  fs.writeFileSync(filePath, buffer);

  const updated: Omit<FileRecord, "id"> = {
    user_id: userId,
    name: originalName,
    extension: ext,
    mime_type: mimeType || null,
    size: buffer.length,
    uploaded_at: Date.now(),
    path: filePath,
  };

  db.prepare(
    "UPDATE files SET name = ?, extension = ?, mime_type = ?, size = ?, uploaded_at = ?, path = ? WHERE id = ? AND user_id = ?"
  ).run(
    updated.name,
    updated.extension,
    updated.mime_type,
    updated.size,
    updated.uploaded_at,
    updated.path,
    id,
    userId
  );

  return { id, ...updated };
}
