import axios from 'axios';
import { API_KEY } from '../const/apiKey';
import { APPLIANCE_API_URL, AUTH_API_URL } from '../const/url';
import { Region } from '../definitions/region';

export const axiosAuth = (region: Region) => axios.create({
    baseURL: AUTH_API_URL[region],
    headers: {
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8',
        'Authorization': 'Bearer',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Ktor client'
    }
});

export const axiosAppliance = axios.create({
    baseURL: APPLIANCE_API_URL,
    headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Charset': 'utf-8',
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'Ktor client'
    }
});