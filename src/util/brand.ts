export const formatBrand = (brand: string) => {
    return brand
        .split(' ')
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(' ');
};
