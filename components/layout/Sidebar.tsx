'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Listbox, ListboxItem } from '@heroui/react';
import Button from '@/components/shared/Button';

interface NavItem {
  label: string;
  href: string;
  icon: string;
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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-64 flex-col bg-content1/50 backdrop-blur-md border-r border-divider p-6 hidden md:flex min-h-screen">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-4 mb-8">
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white text-[20px]">account_balance_wallet</span>
        </div>
        <h2 className="text-foreground text-lg font-bold leading-tight tracking-tight">Bosmat Admin</h2>
      </div>

      {/* Navigation Items using HeroUI Listbox */}
      <Listbox
        aria-label="User Menu"
        variant="flat"
        className="p-0 gap-1"
        itemClasses={{
          base: "px-4 py-3 rounded-xl transition-colors data-[hover=true]:bg-default-100 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary",
          title: "text-sm font-medium group-data-[selected=true]:font-bold text-foreground",
        }}
        selectedKeys={[pathname]}
      >
        {navItems.map((item) => (
          <ListboxItem
            key={item.href}
            as={Link}
            href={item.href}
            startContent={
              <span className={`material-symbols-outlined ${pathname === item.href ? 'text-primary' : 'text-default-400 group-hover:text-primary'} transition-colors`}>
                {item.icon}
              </span>
            }
          >
            {item.label}
          </ListboxItem>
        ))}
      </Listbox>

      {/* Bottom Action Button using our HeroUI-powered Button component */}
      <div className="mt-auto pt-4 border-t border-divider">
        <Button 
          variant="primary" 
          className="w-full h-11"
          startContent={<span className="material-symbols-outlined text-[20px]">add</span>}
        >
          Generate Invoice
        </Button>
      </div>
    </aside>
  );
}
