import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { getAllMessageUsers, getMessages, sendMessage } from "../controllers/message.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

export const messageRouter = Router();

messageRouter.route("/users").get(auth, getAllMessageUsers);
messageRouter.route("/user/:otheruser").get(auth, getMessages);
messageRouter.route("/send").post(upload.single("image"), auth, sendMessage);