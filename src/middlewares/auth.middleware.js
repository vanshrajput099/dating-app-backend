import jwt from "jsonwebtoken";
import asynchandler from "../utils/asynchandler.js";
import APIError from "../utils/APIError.js";
import { driver } from "../db/db.config.js";

export const auth = asynchandler(async (req, res, next) => {
    const token = req.cookies.accessToken;
    const session = driver.session();

    if (!token) {
        throw new APIError(404, "Token not found");
    }

    const verifyToken = await jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (!verifyToken) {
        throw new APIError(402, "Expired Token");
    }

    const userCheck = await session.run(`MATCH (u:User) WHERE u.username = $username RETURN u`, { username: verifyToken.username });

    if (userCheck.records.length === 0) {
        throw new APIError(404, "User not found");
    }

    const user = userCheck.records[0].get("u").properties;

    delete user["password"];
    delete user["refreshToken"];

    req.user = user;
    next();
})