'use client';

import { useState } from 'react';
import { CustomerTable, Customer } from '@/components/crm/CustomerTable';
import { CustomerDetailSheet } from '@/components/crm/CustomerDetailSheet';

export default function CRMPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-6">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Customer Relationship Management</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Kelola data pelanggan, riwayat servis, dan profil motor.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-8">
        <CustomerTable onRowClick={(customer) => setSelectedCustomer(customer)} />
      </div>

      <CustomerDetailSheet 
        customer={selectedCustomer} 
        open={!!selectedCustomer} 
        onOpenChange={(open) => !open && setSelectedCustomer(null)} 
      />
    </div>
  );
}
