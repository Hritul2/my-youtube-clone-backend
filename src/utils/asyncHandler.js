const asyncHandler = (reqHandler) => {
    return (req, res, next) => {
        Promise.resolve(reqHandler(req, res, next)).catch((err) => next(err));
    };
};

export { asyncHandler };

// const asyncHandler = (func) => {
//     async (req, res, next) => {
//         try {
//             await func(req, res, next);
//         } catch (error) {
//             res.status(error.code || 500).json({
//                 success: false,
//                 message: error.message,
//             });
//         }
//     };
// };
