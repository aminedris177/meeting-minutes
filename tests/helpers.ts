import { AppDB } from '../src/db/schema';

let n = 0;
/** قاعدة بيانات جديدة ومعزولة لكل اختبار */
export function freshDbName(): string {
  return `test-db-${Date.now()}-${n++}`;
}

export function freshDb(upTo?: number): AppDB {
  return new AppDB(freshDbName(), upTo);
}
