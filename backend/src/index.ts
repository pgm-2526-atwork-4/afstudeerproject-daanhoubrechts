import "dotenv/config";
import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";

const app = express();
const PORT = process.env.PORT ?? 4000;

// Allow all origins in development so the Angular app can reach the API.
app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
