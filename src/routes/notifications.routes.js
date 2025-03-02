import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { getAllNotifications } from "../controllers/notifications.controller.js";

export const notiRouter = Router();

notiRouter.route("/").get(auth, getAllNotifications);
