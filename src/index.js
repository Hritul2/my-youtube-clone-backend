import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config();

connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.log(`MongoDB connection Fail: ${error}`);
    });
/*
import express from "express";
const app = express();
(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log(`Application not able to talk to db ${error}`);
            throw error;
        });

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on Port ${process.env.PORT}`);
        });
    } catch (error) {
        console.log(`Error in Database Connection ${error}`);
        throw error;
    }
})();
*/
