import { FilterType } from '../definitions/appliance';

export const isParticleFilter = (filterType: FilterType) =>
    filterType === FilterType.ParticleFilter1 ||
    filterType === FilterType.ParticleFilter2;
