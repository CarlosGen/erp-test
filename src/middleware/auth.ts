import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/auth";

// доп типизация для обьекта запроса
export interface AuthedRequest extends Request {
  user?: { id: string; sessionId: string };
}

export function authGuard(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = auth.slice("Bearer ".length);

  const result = verifyAccessToken(token);

  if (!result) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  req.user = { id: result.userId, sessionId: result.sessionId };
  next();
}
