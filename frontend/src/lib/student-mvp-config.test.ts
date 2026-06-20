import { describe, expect, it } from 'vitest';
import {
  STUDENT_CANONICAL_REDIRECTS,
  STUDENT_MVP_BLOCKED_PREFIXES,
  STUDENT_NAV_CONFIG,
} from './student-mvp-config';

describe('student MVP route policy', () => {
  it('all blocked prefixes target student-dashboard and contain no duplicates', () => {
    expect(new Set(STUDENT_MVP_BLOCKED_PREFIXES).size).toBe(STUDENT_MVP_BLOCKED_PREFIXES.length);
    for (const prefix of STUDENT_MVP_BLOCKED_PREFIXES) {
      expect(prefix.startsWith('/student-dashboard/')).toBe(true);
    }
  });

  it('canonical redirect source and target paths are valid student-dashboard routes', () => {
    for (const [from, to] of Object.entries(STUDENT_CANONICAL_REDIRECTS)) {
      expect(from.startsWith('/student-dashboard/')).toBe(true);
      expect(to.startsWith('/student-dashboard/')).toBe(true);
    }
  });

  it('canonical redirect targets are not blocked by STUDENT_MVP_BLOCKED_PREFIXES', () => {
    for (const target of Object.values(STUDENT_CANONICAL_REDIRECTS)) {
      const blocked = STUDENT_MVP_BLOCKED_PREFIXES.some((prefix) => target.startsWith(prefix));
      expect(blocked).toBe(false);
    }
  });

  it('all nav item hrefs start with /student-dashboard and have no duplicates', () => {
    const hrefs: string[] = [];

    for (const group of STUDENT_NAV_CONFIG) {
      for (const item of group.items) {
        if (item.subItems?.length) {
          // When an item has sub-items the parent href is the accordion trigger,
          // not a standalone destination — collect sub-item hrefs only.
          for (const subItem of item.subItems) {
            hrefs.push(subItem.href);
          }
          continue;
        }
        if (item.href) hrefs.push(item.href);
      }
    }

    const externalNavHrefs = new Set(['/affiliate']);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      if (externalNavHrefs.has(href)) continue;
      expect(href.startsWith('/student-dashboard')).toBe(true);
    }
  });

  it('no nav href is blocked by STUDENT_MVP_BLOCKED_PREFIXES', () => {
    for (const group of STUDENT_NAV_CONFIG) {
      for (const item of group.items) {
        if (item.href) {
          const blocked = STUDENT_MVP_BLOCKED_PREFIXES.some((prefix) =>
            item.href!.startsWith(prefix),
          );
          expect(blocked).toBe(false);
        }
        for (const subItem of item.subItems ?? []) {
          const blocked = STUDENT_MVP_BLOCKED_PREFIXES.some((prefix) =>
            subItem.href.startsWith(prefix),
          );
          expect(blocked).toBe(false);
        }
      }
    }
  });
});
