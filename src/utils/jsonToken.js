import jwt from "jsonwebtoken";

export const createAccessToken = async (id, username, gmail) => {
    return await jwt.sign({
        username, id, gmail
    }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRY });
}

export const createRefreshToken = async (id, username) => {
    return await jwt.sign({
        username, id
    }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY });
}