import dotenv from "dotenv/config";
import connectDatabase from "./db/db.config.js";
import { server } from "./app.js";

connectDatabase().then(() => {
    server.listen(process.env.PORT);
}).catch((error) => {
    console.log("Error occured " + error.message);
});