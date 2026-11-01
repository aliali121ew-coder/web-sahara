import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSession, LAST_USER_KEY, logout, savedLogin, SESSION_USER_KEY } from '../session';
import { sessionExpired } from '../../../worker/chat';

const RESUME_KEY = 'sahara_session_resume';
const STARTED_KEY = 'sahara_session_started';
const DAY = 24 * 3600_000;
const YEAR = 365 * DAY;

describe('سياسة الجلسة', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('الخادم ينهي الجلسة بعد 7 أيام من آخر دخول', () => {
    const login = 1_000_000;
    expect(sessionExpired(login, login + 7 * DAY)).toBe(false);
    expect(sessionExpired(login, login + 7 * DAY + 1)).toBe(true);
  });

  it('الجهاز لا يقرر انتهاء الجلسة بنفسه: الخادم وحده يرد 401', () => {
    localStorage.setItem(SESSION_USER_KEY, 'u1');
    localStorage.setItem(STARTED_KEY, String(Date.now() - YEAR));
    expect(hasSession()).toBe(true);
    expect(localStorage.getItem(SESSION_USER_KEY)).toBe('u1');
  });

  it('الدخول المحفوظ متاح حتى نهاية مهلته', () => {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ u: 'ali', until: Date.now() + YEAR }));
    expect(savedLogin()).toBe('ali');
    localStorage.setItem(RESUME_KEY, JSON.stringify({ u: 'ali', until: Date.now() - 1 }));
    expect(savedLogin()).toBe('');
  });

  it('تسجيل الخروج يمسح الجلسة والدخول المحفوظ واسم المستخدم حتى بلا اتصال', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    vi.stubGlobal('location', { reload: vi.fn() });
    localStorage.setItem(SESSION_USER_KEY, 'u1');
    localStorage.setItem(LAST_USER_KEY, 'ali');
    localStorage.setItem(RESUME_KEY, JSON.stringify({ u: 'ali', until: Date.now() + YEAR }));
    await logout();
    expect(hasSession()).toBe(false);
    expect(savedLogin()).toBe('');
    expect(localStorage.getItem(LAST_USER_KEY)).toBeNull();
    expect(location.reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
