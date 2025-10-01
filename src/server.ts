import express from "express";
import dotenv from "dotenv";
import { corsAny } from "./middleware/cors";
import authRoutes from "./routes/auth";
import fileRoutes from "./routes/file";
import "./db";

// Загружаем переменные окружения как можно раньше
dotenv.config();

const app = express();
app.use(corsAny);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(authRoutes);
app.use(fileRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
