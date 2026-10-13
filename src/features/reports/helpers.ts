import { workingDaysBetween } from '@/lib/dates';
import type { Holiday } from '@/data/types';
export { fullName } from '@/data/services';

export function workingDaysBetweenSafe(start: string, end: string, holidays: Holiday[]) {
  return start > end ? 0 : workingDaysBetween(start, end, holidays).length;
}
