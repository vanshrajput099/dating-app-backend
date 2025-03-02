import { getSocketId, io } from "../app.js";
import { driver } from "../db/db.config.js";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import asynchandler from "../utils/asynchandler.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

export const getMessages = asynchandler(async (req, res) => {
    const { otheruser } = req.params;
    const { username } = req.user;
    const session = driver.session();

    try {
        const messageQuery = await session.run(
            `
                MATCH (m:Message)
                WHERE( m.senderUsername = $username AND m.recieverUsername = $otheruser )
                OR ( m.senderUsername = $otheruser AND m.recieverUsername = $username )
                RETURN m
                ORDER BY m.createdAt ASC
            `
            , { username, otheruser }
        );
        const allMessages = messageQuery.records.map((ele) => ele.get("m").properties);
        res.status(200).json(new APIResponse(200, "messages fetched", allMessages));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const sendMessage = asynchandler(async (req, res) => {
    const { otheruser, message } = req.body;
    const { username } = req.user;
    const session = driver.session();

    if (!req.file && (!message || message.trim() === "")) {
        throw new APIError(400, "Atleast message or image is required");
    }

    let imagePath = null;
    let imageUrl = "";
    if (req.file) {
        imagePath = req.file.path;
        try {
            const uploadImage = await uploadFileOnCloudinary(imagePath);
            fs.unlinkSync(imagePath);
            imageUrl = uploadImage.url + "-" + uploadImage.public_id;
        } catch (error) {
            throw new APIError(500, `Error while uploading avatar - ${error.message}`);
        }
    }

    try {
        const createMessage = await session.run(
            `
                CREATE (m:Message{
                    senderUsername:$username,
                    recieverUsername:$otheruser,
                    message:$message,
                    image:$imageUrl,
                    seenBySender:$seenBySender,
                    seenByReciever:$seenByReciever,
                    createdAt:datetime()
                })
                RETURN m
            `,
            { username, otheruser, message, imageUrl, seenBySender: true, seenByReciever: false }
        );

        if (createMessage.records.length === 0) {
            throw new APIError(500, "Internal Server Error while sending message");
        }

        // SOCKET -->
        const messageRes = createMessage.records[0].get("m").properties;
        const otherUserSocketID = getSocketId(otheruser);
        io.to(otherUserSocketID).emit("newMessage", messageRes);
        
        res.status(200).json(new APIResponse(200, "message sended successfully !!", messageRes));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const getAllMessageUsers = asynchandler(async (req, res) => {
    const { username } = req.user;
    const session = driver.session();

    try {
        const userQuery = await session.run(
            `
                MATCH (u:User {username: $username}) 
                MATCH (ou:User)
                WHERE (ou)-[:LIKE]->(u) AND (u)-[:LIKE]->(ou)
                RETURN ou
            `
            , { username }
        );
        const allUsers = userQuery.records.map((ele) => ele.get("ou").properties);
        res.status(200).json(new APIResponse(200, "users fetched", allUsers));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});