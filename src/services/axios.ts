import axios from 'axios';
import { API_KEY } from '../const/apiKey';
import { APPLIANCE_API_URL } from '../const/url';

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