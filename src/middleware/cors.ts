import cors from "cors";

export const corsAny = cors({
  origin: true,
  credentials: true,
});
