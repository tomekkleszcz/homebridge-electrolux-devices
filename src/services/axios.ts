import axios from 'axios';
import { API_KEY } from '../const/apiKey';
import { API_URL } from '../const/url';

export const axiosApi = axios.create({
    baseURL: API_URL,
    headers: {
        Accept: 'application/json',
        'Accept-Charset': 'utf-8',
        'x-api-key': API_KEY,
        'User-Agent': 'Ktor client',
    },
});

export const axiosAuth = axios.create({
    headers: {
        Accept: 'application/json',
        'Accept-Charset': 'utf-8',
        Authorization: 'Bearer',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Ktor client',
    },
});

export const axiosAppliance = axios.create({
    headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Charset': 'utf-8',
        'x-api-key': API_KEY,
        Accept: 'application/json',
        'User-Agent': 'Ktor client',
    },
});
