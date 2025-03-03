
import { driver } from "../db/db.config.js";
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

        res.status(200).json(new APIResponse(200, "All notifications Retrieved Successfully", allNotifications));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

// export const createMatchNotification = asynchandler(async (req, res) => {

//     const session = driver.session();
//     const { title, description, username, otherUsername } = req.body;

//     try {
//         const notification = await session.run(
//             `
//                 CREATE (n:Notification {
//                     title: $title,
//                     description: $description,
//                     username: $username,
//                     otheruser:$otherusername,
//                     createdAt: timestamp()
//                 })
//                 RETURN n
//             `,
//             { title, description, username, otherUsername }
//         );

//         const sendNotification = notification.records[0].get("n").properties;

//         const currentUserSocketId = getSocketId(username);
//         io.to(currentUserSocketId).emit("notification", sendNotification);

//         res.status(201).json(new APIResponse(201, "Notification Created Successfully", sendNotification));
//     } catch (error) {
//         throw new APIError(error.statusCode, error.message);
//     } finally {
//         session.close();
//     }
// });