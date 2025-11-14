// api/migrate.js
// Serverless function to run Prisma migrations on Vercel

import { exec } from "child_process";

export default function handler(req, res) {
  // Allow only POST so people can't spam it accidentally
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST /api/migrate" });
  }

  // Run Prisma migrate deploy (applies any pending migrations)
  exec("npx prisma migrate deploy", (error, stdout, stderr) => {
    if (error) {
      console.error("Prisma migrate error:", stderr);
      return res.status(500).json({
        success: false,
        message: "Migration failed",
        error: stderr,
      });
    }

    console.log("Prisma migrate output:", stdout);
    return res.status(200).json({
      success: true,
      message: "Migration completed successfully",
      output: stdout,
    });
  });
}
