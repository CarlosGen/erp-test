import { Router } from "express";
import { signIn, signUp, refreshToken, revokeSession } from "../services/auth";
import { authGuard, AuthedRequest } from "../middleware/auth";

const router = Router();

// /signup [POST] { id, password }
router.post("/signup", async (req, res) => {
  const { id, password } = req.body ?? {};

  if (!id || !password) {
    res.status(400).json({ message: "id и password обязательны" });
    return;
  }

  try {
    const tokens = await signUp(id, password);
    res.status(201).json(tokens);
    return;
  } catch (e: any) {
    res.status(400).json({ message: e.message || "ошибка при регистрации" });
    return;
  }
});

// /signin [POST] { id, password }
router.post("/signin", async (req, res) => {
  const { id, password } = req.body ?? {};
  if (!id || !password) {
    res.status(400).json({ message: "id и password обязательны" });
    return;
  }
  try {
    const tokens = await signIn(id, password);
    res.json(tokens);
    return;
  } catch (e: any) {
    res.status(401).json({ message: e.message || "неверные данные" });
    return;
  }
});

// /signin/new_token [POST] { refreshToken }
router.post("/signin/new_token", (req, res) => {
  const { refreshToken: rt } = req.body ?? {};
  if (!rt) {
    res.status(400).json({ message: "refreshToken обязателен" });
    return;
  }
  try {
    const tokens = refreshToken(rt);
    res.json(tokens);
    return;
  } catch (e: any) {
    res.status(401).json({ message: e.message || "неверный refresh token" });
    return;
  }
});

// /info [GET]
router.get("/info", authGuard, (req: AuthedRequest, res) => {
  res.json({ id: req.user!.id });
  return;
});

// /logout [GET]
router.get("/logout", authGuard, (req: AuthedRequest, res) => {
  revokeSession(req.user!.sessionId);
  res.json({ message: "ok" });
  return;
});

export default router;
