import { describe, expect, it } from 'vitest';
import { TUTOR_NAV_CONFIG, TUTOR_NAV_PATHS } from './tutor-mvp-config';

describe('tutor MVP route policy', () => {
  it('all TUTOR_NAV_PATHS start with /tutor-dashboard and contain no duplicates', () => {
    expect(new Set(TUTOR_NAV_PATHS).size).toBe(TUTOR_NAV_PATHS.length);
    for (const path of TUTOR_NAV_PATHS) {
      expect(path.startsWith('/tutor-dashboard')).toBe(true);
    }
  });

  it('all nav item hrefs start with /tutor-dashboard', () => {
    for (const group of TUTOR_NAV_CONFIG) {
      for (const item of group.items) {
        if (item.href) {
          expect(item.href.startsWith('/tutor-dashboard')).toBe(true);
        }
        for (const subItem of item.subItems ?? []) {
          expect(subItem.href.startsWith('/tutor-dashboard')).toBe(true);
        }
      }
    }
  });

  it('TUTOR_NAV_PATHS contains every href declared in nav config', () => {
    const pathSet = new Set(TUTOR_NAV_PATHS);

    for (const group of TUTOR_NAV_CONFIG) {
      for (const item of group.items) {
        if (item.href) expect(pathSet.has(item.href)).toBe(true);
        for (const subItem of item.subItems ?? []) {
          expect(pathSet.has(subItem.href)).toBe(true);
        }
      }
    }
  });
});
