'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Percakapan', href: '/conversations', icon: 'chat_bubble' },
  { label: 'Bookings', href: '/bookings', icon: 'event_available' },
  { label: 'CRM', href: '/crm', icon: 'group' },
  { label: 'Follow-ups', href: '/follow-ups', icon: 'schedule' },
  { label: 'Finance', href: '/finance', icon: 'account_balance_wallet' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Navigation Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <nav
        className={`fixed left-0 top-0 h-screen w-64 bg-content1/80 backdrop-blur-lg border-r border-divider p-6 text-foreground transform transition-transform duration-300 z-50 md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-default-100 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-foreground">close</span>
        </button>

        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 mb-8 mt-4">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white">account_balance_wallet</span>
          </div>
          <h2 className="text-foreground text-lg font-bold leading-tight tracking-tight">Bosmat Admin</h2>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer group ${
                  active
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-default-500 hover:bg-default-100 hover:text-foreground'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    active ? 'text-primary' : 'text-default-400 group-hover:text-primary'
                  } transition-colors`}
                >
                  {item.icon}
                </span>
                <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-4 border-t border-divider">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl h-11 px-4 bg-primary text-white text-sm font-bold tracking-tight hover:brightness-105 transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Generate Invoice</span>
          </button>
        </div>
      </nav>
    </>
  );
}
