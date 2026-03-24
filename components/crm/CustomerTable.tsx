'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  lastService: string;
  totalSpending: number;
  bikes: string[];
  status: 'active' | 'churned' | 'new';
}

const mockCustomers: Customer[] = [
  { id: '1', name: 'Budi Santoso', phone: '+6281234567890', lastService: '2023-10-15', totalSpending: 1500000, bikes: ['NMax', 'Vario'], status: 'active' },
  { id: '2', name: 'Andi Wijaya', phone: '+6289876543210', lastService: '2023-01-20', totalSpending: 500000, bikes: ['Beat'], status: 'churned' },
  { id: '3', name: 'Siti Aminah', phone: '+6281112223334', lastService: '2023-10-25', totalSpending: 250000, bikes: ['Scoopy'], status: 'new' },
  { id: '4', name: 'Rudi Hartono', phone: '+6281234567891', lastService: '2023-11-01', totalSpending: 3200000, bikes: ['PCX', 'Aerox'], status: 'active' },
  { id: '5', name: 'Dewi Lestari', phone: '+6289876543212', lastService: '2023-10-28', totalSpending: 150000, bikes: ['Mio'], status: 'new' },
];

export function CustomerTable({ onRowClick }: { onRowClick: (c: Customer) => void }) {
  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead>Pelanggan</TableHead>
            <TableHead>No. HP</TableHead>
            <TableHead>Motor</TableHead>
            <TableHead>Terakhir Servis</TableHead>
            <TableHead className="text-right">Total Transaksi</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockCustomers.map((customer) => (
            <TableRow key={customer.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => onRowClick(customer)}>
              <TableCell className="font-medium flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-teal-100 text-teal-700">{customer.name.substring(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {customer.name}
              </TableCell>
              <TableCell className="text-slate-600">{customer.phone}</TableCell>
              <TableCell>{customer.bikes.join(', ')}</TableCell>
              <TableCell className="text-slate-600">{customer.lastService}</TableCell>
              <TableCell className="text-right font-medium">Rp {customer.totalSpending.toLocaleString('id-ID')}</TableCell>
              <TableCell>
                <Badge variant={customer.status === 'active' ? 'default' : customer.status === 'new' ? 'secondary' : 'destructive'}>
                  {customer.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
