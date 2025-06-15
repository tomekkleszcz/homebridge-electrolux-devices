import { FilterType } from '../definitions/applianceState';

export const isParticleFilter = (filterType: FilterType) =>
    filterType === FilterType.ParticleFilter1 ||
    filterType === FilterType.ParticleFilter2;
