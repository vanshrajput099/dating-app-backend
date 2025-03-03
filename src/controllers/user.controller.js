import { driver } from "../db/db.config.js";
import APIError from "../utils/APIError.js";
import asynchandler from "../utils/asynchandler.js";
import { comparePassword, encryptUserPassword } from "../utils/user.fun.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";
import { sendMailFunction } from "../utils/nodemailer.js";
import { createAccessToken, createRefreshToken } from "../utils/jsonToken.js";
import APIResponse from "../utils/APIResponse.js";
import { getSocketId, io } from "../app.js";

export const checkUsername = asynchandler(async (req, res) => {
    const { username } = req.body;
    const session = driver.session();
    try {
        const checkUsername = await session.run(
            `
                MATCH (u:User {username:$username})
                RETURN u
            `, { username }
        )

        if (checkUsername.records.length > 0) {
            throw new APIError(409, "Username already exist");
        }

        res.status(200).json(new APIResponse(200, "Username is free to use !!", {}));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const checkGmail = asynchandler(async (req, res) => {
    const { gmail } = req.body;
    const session = driver.session();
    try {
        const checkGmail = await session.run(
            `
                MATCH (u:User {gmail:$gmail})
                RETURN u
            `, { gmail }
        )

        if (checkGmail.records.length > 0) {
            throw new APIError(409, "Gmail already exist");
        }

        res.status(200).json(new APIResponse(200, "Gmail is free to use !!", {}));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const registerUser = asynchandler(async (req, res) => {
    const {
        username,
        fullName,
        gmail,
        bio,
        gender,
        genderPrefrence,
        dateOfBirth,
        password,
        location,
        hobbies
    } = req.body;

    if (
        [username, fullName, gmail, gender, genderPrefrence, dateOfBirth, password, location].some(
            (field) => !field || field.trim() === ""
        )
    ) {
        throw new APIError(400, "All Fields Are Necessary");
    }

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(gmail)) {
        throw new APIError(400, "Wrong Gmail Address Input");
    }

    const session = driver.session();
    const existingUserQuery = `MATCH (u:User) WHERE u.gmail = $gmail OR u.username = $username RETURN u`;
    const result = await session.run(existingUserQuery, { gmail, username });

    if (result.records.length > 0) {
        throw new APIError(400, "User already exists with this email.");
    }

    if (!req.files.avatar) {
        throw new APIError(400, "Avatar File is required");
    }

    //Uploading Avatar 
    let avatarFilePath = null;
    let avatarFileUrl = "";
    try {
        avatarFilePath = req.files.avatar[0].path;
        const res = await uploadFileOnCloudinary(avatarFilePath);
        fs.unlinkSync(avatarFilePath);
        avatarFileUrl = res.url + "-" + res.public_id;
    } catch (error) {
        throw new APIError(500, `Error while uploading avatar - ${error.message}`);
    }

    //Uploading Photos
    let photosUrl = [];
    try {
        const photosArr = req.files.photos;
        for (const ele of photosArr) {
            const photoPath = ele.path;
            const res = await uploadFileOnCloudinary(photoPath);
            fs.unlinkSync(photoPath);
            const photoUrl = res.url + "-" + res.public_id;
            photosUrl.push(photoUrl);
        }
    } catch (error) {
        throw new APIError(500, `Error while uploading photos - ${error.message}`);
    }

    try {
        const hashedPassword = await encryptUserPassword(password);
        const createUserQuery = `
            CREATE (u:User {
                username: $username,
                fullName: $fullName,
                gmail: $gmail,
                bio: $bio,
                gender: $gender,
                genderPrefrence: $genderPrefrence,
                dateOfBirth: $dateOfBirth,
                password: $hashedPassword,
                location: $location,
                hobbies: $hobbies,
                avatar: $avatarUrl,
                photos: $photosUrl,
                createdAt: datetime(),
                updatedAt: datetime(),
                refreshToken: $refreshToken,
                lastOnline: $lastOnline
            })
            RETURN u`;

        const createResult = await session.run(createUserQuery, {
            username,
            fullName,
            gmail,
            bio,
            gender,
            genderPrefrence,
            dateOfBirth,
            hashedPassword,
            location,
            hobbies,
            avatarUrl: avatarFileUrl,
            photosUrl: photosUrl,
            refreshToken: "",
            lastOnline: ""
        });

        const newUser = createResult.records[0].get("u").properties;

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: newUser,
        });
    } catch (error) {
        throw new APIError(500, error.message || "Failed to register user");
    } finally {
        await session.close();
    }
});

export const createUserRegistrationOTP = asynchandler(async (req, res) => {
    const { gmail } = req.body;

    const session = driver.session();
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp = otp + Math.floor(Math.random() * 10);
    }

    try {
        const typeCheck = "signup";
        const checkOTPOld = await session.run(
            `
                MATCH (o:OTP{
                    type:$type,
                    gmail:$gmail
                })
                RETURN o
            `, { type: typeCheck, gmail }
        );

        if (checkOTPOld.records.length > 0) {
            await session.run(
                `
                    MATCH (o:OTP{
                        type:$type,
                        gmail:$gmail
                    })
                    DELETE o
                `, { type: typeCheck, gmail }
            );
        }


        const createOTPQuery =
            `
                CREATE (o:OTP{
                OTP: $OTP,
                gmail: $gmail,
                type: $type,
                createdAt: timestamp()
                }) RETURN o 
            `;

        const createOTP = await session.run(createOTPQuery, {
            OTP: otp, gmail, type: "signup"
        });

        const newOTP = createOTP.records[0].get("o").properties;
        await sendMailFunction(gmail, newOTP.OTP);

        res.status(200).json(new APIResponse(200, "Otp Sended Successfully !!"));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const verifyUserRegistrationOTP = asynchandler(async (req, res) => {
    const { gmail, userSendedOTP } = req.body;
    const session = driver.session();

    try {
        const checkOTPQuery = `
            MATCH (o:OTP)
            WHERE o.gmail = $gmail AND o.type = "signup"
            RETURN o
        `

        const OTPFound = await session.run(checkOTPQuery, { gmail });

        if (OTPFound.records.length === 0) {
            throw new APIError(404, "OTP not found.");
        }

        const OTP = OTPFound.records[0].get('o').properties;

        if (OTP.OTP !== userSendedOTP) {
            throw new APIError(402, "Wrong OTP");
        }

        const removeOTPQuery = `
            MATCH (o:OTP)
            WHERE o.gmail = $gmail AND o.OTP = $OTP
            DELETE o
        `

        await session.run(removeOTPQuery, { gmail, OTP: userSendedOTP });
        res.status(201).json(200, "User Verified Successfully");
    } catch (error) {
        throw new APIError(500, error.message);
    } finally {
        session.close();
    }
});

export const loginUser = asynchandler(async (req, res) => {
    const { username, password } = req.body;

    if ([username, password].some((ele) => !ele || ele.trim() === "")) {
        throw new APIError(400, "All Fields are required");
    }

    const session = driver.session();

    try {
        const userCheckQuery = `
            MATCH (u:User)
            WHERE u.username = $username
            RETURN u, id(u) AS userId
        `

        const userCheck = await session.run(userCheckQuery, { username });

        if (userCheck.records.length === 0) {
            throw new APIError(404, "No user found with this username");
        }

        const user = userCheck.records[0].get("u").properties;
        const userId = userCheck.records[0].get("userId").low;

        const passwordCheck = await comparePassword(password, user.password);
        if (!passwordCheck) {
            throw new APIError(402, "Wrong Password");
        }

        const accessToken = await createAccessToken(userId, user.username, user.gmail);
        const refreshToken = await createRefreshToken(userId, user.username);

        const updateUserQuery = `
            MATCH (u:User)
            WHERE u.username = $username
            SET u.refreshToken = $refreshToken
            RETURN u
        `

        const updatedUserCheck = await session.run(updateUserQuery, { username, refreshToken });
        const updatedUser = updatedUserCheck.records[0].get("u").properties;

        delete updatedUser["password"];
        delete updatedUser["refreshToken"];
        res
            .cookie("accessToken", accessToken, { httpOnly: true, secure: true })
            .json(new APIResponse(200, "User logged in successfully !!", updatedUser));
    } catch (error) {
        throw new APIError(500, error.message);
    } finally {
        session.close();
    }
});

export const verifyAuthUser = asynchandler(async (req, res) => {
    if (!req.user) {
        throw new APIError(402, "Unauthorized User");
    }

    res.status(200).json(new APIResponse(200, "User is authenticated", req.user));
});

export const logoutUser = asynchandler(async (req, res) => {
    const { username } = req.user;

    const session = driver.session();

    try {
        const userCheck = await session.run(
            `MATCH (u:User)
            WHERE u.username = $username
            RETURN u
            ` , { username }
        );

        if (userCheck.records.length === 0) {
            throw new APIError(404, "User not found");
        }

        const user = userCheck.records[0].get("u").properties;

        const updateUser = await session.run(
            `MATCH (u:User)
            WHERE u.username = $username
            SET u.lastOnline = datetime()
            SET u.refreshToken = $refreshToken
            RETURN u
            `, { username, refreshToken: "" }
        );

        return res
            .clearCookie("accessToken", { httpsOnly: true, secure: true })
            .status(200).json(new APIResponse(200, "User logged out successfully !!"));

    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});


export const updateUsername = asynchandler(async (req, res) => {

    const { newUsername } = req.body;
    const { username } = req.user;
    const session = driver.session();

    if (!newUsername || newUsername.trim() === "") {
        throw new APIError(400, "Provide new username");
    }

    try {
        const checkExistingUser = await session.run(
            `
                MATCH (u:User)
                WHERE u.username = $newUsername
                RETURN u
            `
            , { newUsername }
        );

        if (checkExistingUser.records.length > 0) {
            throw new APIError(409, "User with given username already exists !!");
        }

        const userCheck = await session.run(
            `
                MATCH (u:User)
                WHERE u.username = $username
                SET u.username = $newUsername
                RETURN u
            `,
            { username, newUsername }
        );

        if (userCheck.records.length === 0) {
            throw new APIError(500, "Server error while updating username");
        }

        // Change in all messages -->
        const allMessagesChange = await session.run(
            `
                MATCH (m:Message)
                WHERE m.senderUsername = $username
                OR m.recieverUsername = $username
                SET 
                    m.senderUsername = CASE WHEN m.senderUsername = $username THEN $newUsername ELSE m.senderUsername END,
                    m.recieverUsername = CASE WHEN m.recieverUsername = $username THEN $newUsername ELSE m.recieverUsername END
                RETURN m
            `,
            { username, newUsername }
        );

        res.status(200).json(new APIResponse(200, "Username changed successfully !!"));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const updateBIO = asynchandler(async (req, res) => {
    const { newBio } = req.body;
    const { username } = req.user;
    const session = driver.session();

    if (!newBio || newBio.trim() === "") {
        throw new APIError(400, "Provide new bio");
    }

    try {
        const bioChange = await session.run(
            `
                MATCH (u:User)
                WHERE u.username = $username
                SET u.bio = $newBio
                RETURN u
            `,
            { username, newBio }
        );

        if (bioChange.records.length === 0) {
            throw new APIError(500, "Server error while updating BIO");
        }
        res.status(200).json(new APIResponse(200, "Bio changed successfully !!"));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const updateGenderPrefrence = asynchandler(async (req, res) => {
    const { newGenderPrefrence } = req.body;
    const { username } = req.user;
    const session = driver.session();

    if (!newGenderPrefrence || newGenderPrefrence.trim() === "") {
        throw new APIError(400, "Provide new bio");
    }

    try {
        const newGenderChange = await session.run(
            `
                MATCH (u:User)
                WHERE u.username = $username
                SET u.genderPrefrence = $newGenderPrefrence
                RETURN u
            `,
            { username, newGenderPrefrence }
        );

        if (newGenderChange.records.length === 0) {
            throw new APIError(500, "Server error while updating Gender Prefrence");
        }
        res.status(200).json(new APIResponse(200, "Gender Prefrence changed successfully !!"));

    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});

export const getAllUsers = asynchandler(async (req, res) => {
    const { username, genderPrefrence } = req.user;
    const session = driver.session();
    try {
        const otherUsers = await session.run(
            `
                MATCH (cu:User {username: $username})
                MATCH (ou:User)
                WHERE cu <> ou
                AND NOT (cu)-[:LIKE|:DISLIKE]->(ou)
                RETURN ou
            `,
            { username }
        );

        const allUsers = otherUsers.records.map((ele) => {
            if (genderPrefrence === "both" || genderPrefrence === ele.get("ou").properties.gender) {
                return ele.get("ou").properties
            }
            return;
        });

        res.status(200).json(new APIResponse(200, "All users fetched", allUsers));

    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }

});

export const swipeUser = asynchandler(async (req, res) => {
    const { swipe, otheruser } = req.body;
    const { username } = req.user;

    const session = driver.session();
    const match = swipe === "left" ? "DISLIKE" : "LIKE";

    try {
        const matchUser = await session.run(
            `
                MATCH (cu:User{username:$username}) , (ou:User{username:$otheruser})
                CREATE (cu)-[:${match}]->(ou)
                RETURN cu
            `
            , { username, otheruser }
        );

        if (matchUser.records.length === 0) {
            throw new APIError(500, "Server error while matching");
        }

        const checkMatch = await session.run(
            `
               MATCH (cu:User{username:$username}) , (ou:User{username:$otheruser})
                WHERE (ou)-[:LIKE]->(cu)
                RETURN ou
            `
            , { username, otheruser }
        );

        if (checkMatch.records.length > 0) {

            const ou = checkMatch.records[0].get("ou").properties;
            const currentUserSocketId = getSocketId(username);

            try {
                const title = "New Match";
                const currentUserDescription = "You have a new match with " + ou.fullName;
                const avatar = ou.avatar;

                const currentUserNotification = await session.run(
                    `
                        CREATE (n:Notification {
                            title: $title,
                            description: $currentUserDescription,
                            username: $username,
                            otheruser:$otheruser,
                            notificationAvatar:$avatar,
                            createdAt: timestamp()
                        })
                        RETURN n
                `,
                    { title, currentUserDescription, username, otheruser, avatar }
                );

                const otherAvatar = req.user.avatar;
                const otherUserDescription = "You have a new match with " + req.user.fullName;
                const otherUserNotification = await session.run(
                    `
                        CREATE (n:Notification {
                            title: $title,
                            description: $otherUserDescription,
                            username: $otheruser,
                            otheruser:$username,
                            notificationAvatar:$otherAvatar,
                            createdAt: timestamp()
                        })
                        RETURN n
                `,
                    { title, otherUserDescription, username, otheruser, otherAvatar }
                );

                const sendCurrentUserNotification = currentUserNotification.records[0].get("n").properties;
                const sendOtherUserNotification = otherUserNotification.records[0].get("n").properties;

                const otherUserSocketId = getSocketId(otheruser);

                if (currentUserSocketId) {
                    io.to(currentUserSocketId).emit("notification", sendCurrentUserNotification);
                    io.to(currentUserSocketId).emit("newMatch", ou);
                }

                if (otherUserSocketId) {
                    io.to(otherUserSocketId).emit("notification", sendOtherUserNotification);
                    io.to(otherUserSocketId).emit("newMatch", req.user);
                }

            } catch (error) {
                throw new APIError(error.statusCode, error.message);
            }

            res.status(200).json(new APIResponse(200, "match", ou));
            return;
        }

        res.status(200).json(new APIResponse(200, "Match created successfully !!"));
    } catch (error) {
        throw new APIError(error.statusCode, error.message);
    } finally {
        session.close();
    }
});
