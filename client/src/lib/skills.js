import api from '../api/axios';
import { useQuery } from './hooks';

/**
 * The tech skill catalog lives on the server (server/config/catalog.js) so every screen and every
 * API check agrees on it. It never changes at runtime, so it is fetched once and shared.
 */
let pending = null;
const loadCatalog = () => {
  pending ||= api.get('/catalog').then((response) => response.data).catch((error) => { pending = null; throw error; });
  return pending;
};

export function useSkillCatalog() {
  const { data, loading, error, reload } = useQuery(loadCatalog, [], { focus: false });
  return { catalog: data, categories: data?.categories || [], loading, error, reload };
}

/** Flat list of { skill, category, categoryId } for searching. */
export const flattenSkills = (categories) => categories.flatMap((category) => category.skills.map((skill) => ({ skill, category: category.name, categoryId: category.id })));
