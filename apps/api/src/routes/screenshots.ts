import { Router } from "express";
import { userIdOf } from "../middleware/auth";
import { screenshotPath } from "../storage";
import { findOwnedAudit } from "./audits";

export const screenshotsRouter = Router();

const SAFE_NAME = /^[\w-]+\.(png|jpe?g|webp)$/;

screenshotsRouter.get("/:id/screenshots/:name", async (req, res) => {
  const { id, name } = req.params;
  if (!SAFE_NAME.test(name) || !(await findOwnedAudit(id, userIdOf(req)))) {
    res.status(404).end();
    return;
  }
  res.sendFile(screenshotPath(id, name), { headers: { "Cache-Control": "private, max-age=86400" } }, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
