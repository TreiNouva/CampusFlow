'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/actions/auth-actions';
import { Icon, type IconName } from '@/components/ui/icons';
import { OnboardingTour, openTour } from '@/components/onboarding/onboarding-tour';
import { cn, initials } from '@/lib/utils';

export interface MenuItem { href: string; label: string; icon: IconName; exact?: boolean }
export interface MenuSection { title: string; items: MenuItem[] }
export interface ProjectHeader { backHref: string; backLabel: string; title: string; subtitle: string }

function isActive(pathname: string, item: MenuItem) {
  const path = item.href.split('#')[0];
  if (item.exact) return pathname === path;
  return pathname === path || pathname.startsWith(path + '/');
}

export function ShellFrame({
  sections, header, bottomNav, user, showTour, children,
}: {
  sections: MenuSection[];
  header?: ProjectHeader;
  bottomNav?: MenuItem[];
  user: { name: string; email: string };
  showTour: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // Tutup drawer setiap pindah halaman, dan kunci scroll halaman saat drawer terbuka.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  const current = sections.flatMap((s) => s.items).find((i) => isActive(pathname, i));

  const menu = (
    <nav className="flex h-full flex-col" aria-label="Menu utama">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <Link href="/dashboard" className="font-heading text-lg font-bold text-navy">CampusFlow</Link>
        <button type="button" onClick={() => setDrawer(false)} className="rounded-lg p-1.5 text-muted hover:bg-gray-100 lg:hidden" aria-label="Tutup menu">
          <Icon name="close" />
        </button>
      </div>

      {header && (
        <div className="mx-3 mb-2 rounded-xl bg-gray-50 px-3 py-3">
          <Link href={header.backHref} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-navy">
            <Icon name="chevronLeft" size={14} /> <span className="truncate">{header.backLabel}</span>
          </Link>
          <p className="mt-1 truncate font-heading text-[15px] font-bold text-ink" title={header.title}>{header.title}</p>
          <p className="truncate text-xs text-muted">{header.subtitle}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((s) => (
          <div key={s.title} className="mt-3">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{s.title}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? 'page' : undefined}
                      className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        active ? 'bg-sky font-semibold text-navy' : 'text-gray-600 hover:bg-gray-50 hover:text-ink')}>
                      <Icon name={item.icon} size={18} className={active ? 'text-navy' : 'text-gray-400'} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {header && (
          <div className="mt-3">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Umum</p>
            <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-ink">
              <Icon name="grid" size={18} className="text-gray-400" /> Semua organisasi
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-line px-3 py-3">
        <button type="button" onClick={() => { setDrawer(false); openTour(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-ink">
          <Icon name="help" size={18} className="text-gray-400" /> Panduan singkat
        </button>
        <div className="mt-2 flex items-center gap-2.5 px-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{initials(user.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink" aria-label="Keluar" title="Keluar">
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">{menu}</aside>

      {/* Bar atas HP/tablet */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setDrawer(true)} className="rounded-lg p-2 text-ink hover:bg-gray-100" aria-label="Buka menu" aria-expanded={drawer}>
          <Icon name="menu" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{header?.title ?? 'CampusFlow'}</p>
          {current && <p className="truncate text-xs text-muted">{current.label}</p>}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{initials(user.name)}</span>
      </header>

      {/* Drawer HP */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="animate-fade-in absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} aria-label="Tutup menu" />
          <div className="drawer-in absolute inset-y-0 left-0 w-[84%] max-w-xs bg-white shadow-xl">{menu}</div>
        </div>
      )}

      <div className={cn('lg:pl-64', bottomNav && 'pb-20 lg:pb-0')}>{children}</div>

      {/* Navigasi bawah HP (gaya aplikasi m-banking): 4 menu utama + Menu lainnya */}
      {bottomNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navigasi cepat">
          <ul className="grid grid-cols-5">
            {bottomNav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px]', active ? 'font-semibold text-navy' : 'text-gray-500')}>
                    <Icon name={item.icon} size={20} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] text-gray-500">
                <Icon name="grid" size={20} />
                Lainnya
              </button>
            </li>
          </ul>
        </nav>
      )}

      <OnboardingTour initialOpen={showTour} inProject={Boolean(header)} />
    </div>
  );
}
