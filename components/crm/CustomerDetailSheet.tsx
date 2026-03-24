'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Customer } from "./CustomerTable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailSheet({ customer, open, onOpenChange }: Props) {
  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-slate-50">
        <SheetHeader className="mb-6 bg-white p-6 -mx-6 -mt-6 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-teal-100 text-teal-700">{customer.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-2xl font-black text-slate-800">{customer.name}</SheetTitle>
              <SheetDescription className="text-base text-slate-500">{customer.phone}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="py-3 px-4 bg-slate-50/50">
                <CardTitle className="text-xs uppercase font-bold tracking-wider text-slate-500">Total Transaksi</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="text-2xl font-black text-slate-800">Rp {customer.totalSpending.toLocaleString('id-ID')}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="py-3 px-4 bg-slate-50/50">
                <CardTitle className="text-xs uppercase font-bold tracking-wider text-slate-500">Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Badge variant={customer.status === 'active' ? 'default' : customer.status === 'new' ? 'secondary' : 'destructive'} className="text-sm px-3 py-1">
                  {customer.status.toUpperCase()}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-slate-200">
            <div className="p-4 bg-white rounded-xl">
              <h3 className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Kendaraan Dimiliki
              </h3>
              <div className="flex gap-2 flex-wrap">
                {customer.bikes.map(bike => (
                  <Badge key={bike} variant="outline" className="text-sm py-1 px-3 border-slate-300 bg-slate-50 text-slate-700">{bike}</Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <div className="p-4 bg-white rounded-xl">
              <h3 className="font-bold mb-4 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Riwayat Servis Terakhir
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <div className="font-semibold text-slate-800">Servis Berkala & Ganti Oli</div>
                    <div className="text-sm font-medium text-slate-500">{customer.lastService}</div>
                  </div>
                  <div className="font-bold text-teal-600">Rp 250.000</div>
                </div>
                {/* Additional dummy history if needed */}
              </div>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
