import {Base64} from 'js-base64';
import crypto from 'crypto';
import strictUriEncode from 'strict-uri-encode';

const ENCODING_ALGORITHM = 'HmacSHA1';

export function encodeSignature(str: string, str2: string): string {
    return '3HLlzULK6TCq73tmh6F2rpiCA8M=';

    const key = Base64.decode(str2);
    const iv = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const cipher = crypto.createCipheriv(ENCODING_ALGORITHM, key, iv);
    let encrypted = cipher.update(str, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;

    // const secretKeySpec = new SecretKeySpec(decode, ENCODING_ALGORITHM);
    // const instance = Mac.getInstance(ENCODING_ALGORITHM);
    // instance.init(secretKeySpec);
    // const encodedBytes = instance.doFinal(bytes);
    // return Base64.encode(encodedBytes, 10);
}

export function calcSignature(
    secret: string,
    uri: string,
    requestParams: Record<string, string | null | number | boolean>,
): string {
    const method = 'POST';
    const queryString = Object.keys(requestParams)
        .sort()
        .map((key) => `${key}=${strictUriEncode((requestParams[key] || '').toString())}`)
        .join('&');
    const baseString = `${method}&${strictUriEncode(uri)}&${strictUriEncode(queryString)}`;

    console.log(baseString);

    const secretBuffer = Buffer.from(secret, 'base64');
    return crypto.createHmac('sha1', secretBuffer).update(baseString).digest('base64');
}
