// export type LoginResponse = {
//     UID: string;
//     sessionInfo: {
//         sessionToken: string;
//         sessionSecret: string;
//     };
// };

// export type JWTResponse = {
//     id_token: string;
// };

export type TokenResponse = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
};
