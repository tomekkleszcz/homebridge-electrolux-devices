export type IdentityProvidersResponse = Brand[];

type Brand = {
    domain: string;
    apiKey: string;
    brand: string;
    httpRegionalBaseUrl: string;
    webSocketRegionalBaseUrl: string;
    dataCenter: string;
};