import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { refreshToken, accessToken };
    } catch (error) {
        throw new ApiError(
            500,
            `Something went wrong while generating access and referesh token`
        );
    }
};
const registerUser = asyncHandler(async (req, res) => {
    // get user details  from frontend
    // validation - not empty
    // check is user already exist
    // check for images & avatar
    // upload them to cloudinary, avatar
    // create user object
    // create entry on db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { fullname, username, password, email } = req.body;
    //console.log(`email: ${email}`);

    if (
        [fullname, username, password, email].some((item) => {
            return item?.trim() === "";
        })
    ) {
        throw new ApiError(400, "All field are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exist");
    }
    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage && req.files.coverImage.length > 0)
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, `Avatar file is required`);
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, `Avatar file is required`);
    }
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        username: username.toLowerCase(),
        coverImage: coverImage?.url || "",
        email,
        password,
    });
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the User"
        );
    }

    return res
        .status(201)
        .json(new ApiResponse(200, createdUser, `User registered Succesfully`));
});

const loginUser = asyncHandler(async (req, res) => {
    // req bddy data
    const { email, username, password } = req.body;
    // username or email
    if (!email && !username) {
        throw new ApiError(400, "username or password is required");
    }
    // find user
    const user = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (!user) {
        throw new ApiError(404, `User doesn't exist`);
    }
    // password check
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, `Invalid User Credentials`);
    }
    // access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // send secure cookies
    const options = {
        httpOnly: true,
        secure: true,
    };
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                `User Logged in succesfully`
            )
        );
});

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            },
        },
        {
            new: true,
        }
    );
    const options = {
        httpOnly: true,
        secure: true,
    };
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, `User Logged Out`));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefereshToken =
        req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefereshToken) {
        throw new ApiError(401, `Unauthorized Request`);
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefereshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, `Invalid refresh Token`);
        }

        if (incomingRefereshToken !== user?.refreshToken) {
            throw new ApiError(401, `Refresh Token Is Expired or Used`);
        }

        const options = {
            httpOnly: true,
            secure: true,
        };
        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    `Access Token Refreshed Successfully`
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || `Invalid refresh token`);
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, `Invalid Old Password`);
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, `Password Changed Successfully`));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, `current user fetched succesfully`)
        );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { email, fullname } = req.body;

    if (!fullname || !email) {
        throw new ApiError(400, `All Fields are required`);
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, `Accounts details updated successfully`)
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, `File is Missing`);
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, `Error while uploading on avatar`);
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, `Updated User Avatar`));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, `File is Missing`);
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, `Error while uploading on cover image`);
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, `Updated User Cover Image`));
});

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
};
