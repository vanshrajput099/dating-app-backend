import { driver } from "../db/db.config";
import APIError from "../utils/APIError.js";
import APIResponse from "../utils/APIResponse.js";
import asynchandler from "../utils/asynchandler.js";

export const getAllNotifications = asynchandler(async (req, res) => {

    const { username } = req.user;
    const session = driver.session();

    try {
        const notifications = await session.run(
            `
                MATCH (n:Notification)
                WHERE n.username = $username
                RETURN n
            `,
            { username }
        );

        const allNotifications = notifications.records.map((notification) => {
            return notification.get("n").properties;
        });

        res.status(200).json(new APIResponse(200, notifications, "All notifications Retrieved Successfully"));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const createNotification = asynchandler(async (username, title, description) => {

    const session = driver.session();

    try {
        const notification = await session.run(
            `
                CREATE (n:Notification {
                    title: $title,
                    description: $description,
                    username: $username,
                    createdAt: timestamp()
                })
                RETURN n
            `,
            { title, description, username }
        );

        const sendNotification = notification.records[0].get("n").properties;
        return sendNotification;
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});