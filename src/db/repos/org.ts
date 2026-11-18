import { db, type AppDB } from '../schema';
import type { Org } from '../types';

export async function getOrg(d: AppDB = db): Promise<Org> {
  return (await d.org.get('org')) ?? { id: 'org', name: '', updatedAt: 0 };
}

export async function saveOrgName(name: string, d: AppDB = db): Promise<void> {
  const org = await getOrg(d);
  await d.org.put({ ...org, name: name.trim(), updatedAt: Date.now() });
}

export async function saveOrgLogo(logo: Blob | undefined, d: AppDB = db): Promise<void> {
  const org = await getOrg(d);
  const next: Org = { ...org, updatedAt: Date.now() };
  if (logo) next.logo = logo;
  else delete next.logo;
  await d.org.put(next);
}
