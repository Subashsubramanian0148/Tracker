import { describe, expect, it } from 'vitest';
import { safeLogoutTarget } from '../api/auth';
import { validateDelayReason } from '../features/work-item/DelayReasonForm';
import { canAddDelayReason, canViewPeople, hasRole } from './auth';

describe('role helpers', () => {
  const viewer = { roles: ['Viewer' as const], email: 'Dev@Example.com' };

  it('checks any-of roles', () => {
    expect(hasRole({ roles: ['Manager'] }, 'TeamLead', 'Manager')).toBe(true);
    expect(hasRole(viewer, 'Admin')).toBe(false);
    expect(canViewPeople(viewer)).toBe(false);
    expect(canViewPeople({ roles: ['TeamLead'] })).toBe(true);
  });

  it('lets the assignee (case-insensitive email) or leads add delay reasons', () => {
    expect(
      canAddDelayReason(viewer, { id: '1', displayName: 'Dev', email: 'dev@example.COM' }),
    ).toBe(true);
    expect(
      canAddDelayReason(viewer, { id: '2', displayName: 'Other', email: 'other@example.com' }),
    ).toBe(false);
    expect(canAddDelayReason(viewer, { id: '3', displayName: 'Hidden' })).toBe(false);
    expect(canAddDelayReason(viewer, null)).toBe(false);
    expect(canAddDelayReason({ roles: ['TeamLead'], email: 'x@y.z' }, null)).toBe(true);
  });
});

describe('safeLogoutTarget', () => {
  it.each([
    [null, '/'],
    [
      'https://login.microsoftonline.com/t/oauth2/v2.0/logout?x=1',
      'https://login.microsoftonline.com/t/oauth2/v2.0/logout?x=1',
    ],
    ['http://insecure.example/logout', '/'],
    ['javascript:alert(1)', '/'],
    ['//evil.example', '/'],
    ['/signed-out', '/signed-out'],
  ])('%s → %s', (input, expected) => {
    expect(safeLogoutTarget(input)).toBe(expected);
  });
});

describe('validateDelayReason', () => {
  it('requires a category and a 10+ char comment, and bounds impact days', () => {
    expect(validateDelayReason({ categoryId: '', comment: 'short', impactDays: '400' })).toEqual({
      categoryId: expect.any(String),
      comment: expect.any(String),
      impactDays: expect.any(String),
    });
    expect(
      validateDelayReason({ categoryId: 'c1', comment: 'Waiting on another team', impactDays: '' }),
    ).toEqual({});
  });
});
