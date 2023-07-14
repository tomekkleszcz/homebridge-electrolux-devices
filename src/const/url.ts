import { Region } from '../definitions/region';

export const AUTH_API_URL: Record<Region, string> = {
    'eu': 'https://api.eu.ocp.electrolux.one/one-account-authorization/api/v1',
    'us': 'https://api.us.ocp.electrolux.one/one-account-authorization/api/v1',
    'au': 'https://api.au.ocp.electrolux.one/one-account-authorization/api/v1',
    'ru': 'https://api.ru.ocp.electrolux.one/one-account-authorization/api/v1',
    'cn': 'https://api.cn.ocp.electrolux.one/one-account-authorization/api/v1',
    'il': 'https://api.il.ocp.electrolux.one/one-account-authorization/api/v1'
};

export const APPLIANCE_API_URL = 'https://api.eu.ocp.electrolux.one/appliance/api/v2';