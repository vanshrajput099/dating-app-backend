import { Router } from "express";
import { checkGmail, checkUsername, createUserRegistrationOTP, getAllUsers, loginUser, logoutUser, registerUser, swipeUser, verifyAuthUser, verifyUserRegistrationOTP } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { auth } from "../middlewares/auth.middleware.js";

export const userRouter = Router();

userRouter.route("/sign-up").post(upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "photos", maxCount: 3 }
]), registerUser);
userRouter.route("/check/username").post(checkUsername);
userRouter.route("/check/gmail").post(checkGmail);
userRouter.route("/sign-up/send/otp").post(createUserRegistrationOTP);
userRouter.route("/sign-up/verify/otp").post(verifyUserRegistrationOTP);
userRouter.route("/login").post(loginUser);
userRouter.route("/logout").post(auth, logoutUser);
userRouter.route("/check-auth").get(auth, verifyAuthUser);
userRouter.route("/all-users").get(auth, getAllUsers);
userRouter.route("/swipe-user").post(auth, swipeUser);