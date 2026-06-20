import { describe, expect, it } from 'vitest';
import { ADMIN_MVP_ALLOWED_PATHS, ADMIN_MVP_NAV_CONFIG, getAdminRouteMode, isAllowedAdminPath } from './admin-mvp-config';

describe('admin MVP route synchronization', () => {
  it('keeps every sidebar route reachable through middleware allowlist', () => {
    const allowed = new Set(ADMIN_MVP_ALLOWED_PATHS);

    for (const group of ADMIN_MVP_NAV_CONFIG) {
      for (const item of group.items) {
        if (item.subItems?.length) {
          for (const subItem of item.subItems) {
            expect(allowed.has(subItem.href)).toBe(true);
          }

          // Only /admin parent is meant to be directly reachable with sub-items.
          if (item.href === '/admin') {
            expect(allowed.has(item.href)).toBe(true);
          }
          continue;
        }

        if (item.href) {
          expect(allowed.has(item.href)).toBe(true);
        }
      }
    }
  });

  it('contains auth/entrypoint paths required outside sidebar links', () => {
    const allowed = new Set(ADMIN_MVP_ALLOWED_PATHS);
    expect(allowed.has('/admin')).toBe(true);
    expect(allowed.has('/admin/login')).toBe(true);
    expect(allowed.has('/admin/notifications')).toBe(true);
  });

  it('only includes admin-prefixed routes and has no duplicates', () => {
    expect(new Set(ADMIN_MVP_ALLOWED_PATHS).size).toBe(ADMIN_MVP_ALLOWED_PATHS.length);
    for (const path of ADMIN_MVP_ALLOWED_PATHS) {
      expect(path.startsWith('/admin')).toBe(true);
    }
  });

  it('allows configured dynamic admin routes and rejects unknown ones', () => {
    const previousMode = process.env.ADMIN_ROUTE_MODE;
    process.env.ADMIN_ROUTE_MODE = 'mvp';
    expect(isAllowedAdminPath('/admin/courses/abc123/edit')).toBe(true);
    expect(isAllowedAdminPath('/admin/classroom/course-1')).toBe(true);
    expect(isAllowedAdminPath('/admin/classroom/course-1/lectures')).toBe(true);
    expect(isAllowedAdminPath('/admin/classroom/course-1/qa')).toBe(true);
    expect(isAllowedAdminPath('/admin/classroom/course-1/messages')).toBe(true);

    expect(isAllowedAdminPath('/admin/classroom/course-1/grades')).toBe(false);
    expect(isAllowedAdminPath('/admin/courses/abc123/delete')).toBe(false);
    process.env.ADMIN_ROUTE_MODE = previousMode;
  });

  it('switches to full admin route mode when configured', () => {
    const previousMode = process.env.ADMIN_ROUTE_MODE;
    process.env.ADMIN_ROUTE_MODE = 'full';
    expect(getAdminRouteMode()).toBe('full');
    expect(isAllowedAdminPath('/admin/any/new/module')).toBe(true);
    expect(isAllowedAdminPath('/admin/classroom/course-1/grades')).toBe(true);
    expect(isAllowedAdminPath('/not-admin')).toBe(false);
    process.env.ADMIN_ROUTE_MODE = previousMode;
  });
});
