import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        // Extract token from cookie or Authorization header
        const token =
            req.cookies?.accessToken || // Using req.cookies instead of req.cookie
            req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized Request");
        }

        // Verify the token using the secret
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Fetch user details from the database
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken"
        );

        if (!user) {
            throw new ApiError(401, `Invalid Access Token`);
        }

        // Attach user object to the request for further use
        req.user = user;

        // Call next middleware
        next();
    } catch (error) {
        // Catch and throw custom error
        throw new ApiError(401, error?.message || `Invalid Access Token`);
    }
});
