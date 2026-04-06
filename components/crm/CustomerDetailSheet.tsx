'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Customer, Vehicle } from "./CustomerTable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Info, 
  History, 
  ShieldCheck, 
  Calendar, 
  AlertCircle, 
  Clock,
  Bike
} from "lucide-react";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BookingHistory {
  id: string;
  bookingDate: string;
  serviceType: string;
  status: string;
  plateNumber?: string;
  vehicleModel?: string;
}

export interface VehicleDetail {
  id: string;
  modelName: string;
  plateNumber: string | null;
  color: string | null;
  serviceCount: number;
  bookings?: Array<{
    id: string;
    bookingDate: string;
    serviceType: string;
    status: string;
  }>;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  lastService: string | null;
  totalSpending: number;
  vehicles: VehicleDetail[];
  bookings?: BookingHistory[];
  status: 'active' | 'churned' | 'new';
  warranties?: Array<{
    id: string;
    type: string;
    vehicle: string;
    plateNumber?: string;
    startDate: string;
    expiryDate: string;
    status: 'ACTIVE' | 'EXPIRED' | 'VOID';
    lastMaintenance?: string;
    nextMaintenance?: string | null;
    serviceType: string;
  }>;
}

interface Props {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailSheet({ customer, open, onOpenChange }: Props) {
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer?.id && open) {
      fetchCustomerDetail(customer.id);
    }
  }, [customer?.id, open]);

  const fetchCustomerDetail = async (customerId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}`);
      const data = await res.json();
      if (data.success) {
        setCustomerDetail(data.customer);
      }
    } catch (error) {
      console.error('Error fetching customer detail:', error);
      setCustomerDetail(customer as unknown as CustomerDetail);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (!customer) return null;

  const displayCustomer = customerDetail || customer;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-[#131313] border-l border-[#2A2A2A] text-white p-0">
        <SheetHeader className="mb-6 bg-[#1C1B1B] p-6 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-sm">
              <AvatarFallback className="text-xl bg-[#FFFF00] text-black font-black rounded-sm border border-[#FFFF00]">
                {displayCustomer.name.substring(0,2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-2xl font-black text-white">{displayCustomer.name}</SheetTitle>
              <SheetDescription className="text-sm font-technical text-slate-400">
                {displayCustomer.phone}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 pb-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-[#1C1B1B] p-1 border border-[#2A2A2A] rounded-sm h-auto">
              <TabsTrigger 
                value="overview" 
                className="gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:bg-[#2A2A2A] data-[state=active]:text-white rounded-sm transition-colors"
               >
                <Info className="h-4 w-4" />
                Info
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:bg-[#2A2A2A] data-[state=active]:text-white rounded-sm transition-colors"
               >
                <History className="h-4 w-4" />
                Riwayat
              </TabsTrigger>
              <TabsTrigger 
                value="warranty" 
                className="gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:bg-[#2A2A2A] data-[state=active]:text-white rounded-sm transition-colors"
               >
                <ShieldCheck className="h-4 w-4" />
                Garansi
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="mt-0 space-y-4 outline-none">
              <div className="grid grid-cols-2 gap-4">
                {/* Total Spending */}
                <div className="bg-[#1C1B1B] border border-[#2A2A2A] p-4 flex flex-col gap-2 rounded-sm">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Total Revenue</div>
                  <div className="text-xl font-headline font-black text-[#FFFF00]">
                    Rp {(displayCustomer.totalSpending || 0).toLocaleString('id-ID')}
                  </div>
                </div>
                
                {/* Status */}
                <div className="bg-[#1C1B1B] border border-[#2A2A2A] p-4 flex flex-col gap-2 rounded-sm items-start justify-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Status DB</div>
                  {displayCustomer.status === 'active' && <span className="text-[10px] px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-sm font-bold uppercase tracking-widest">Active</span>}
                  {displayCustomer.status === 'new' && <span className="text-[10px] px-2 py-1 bg-sky-950 text-sky-400 border border-sky-900 rounded-sm font-bold uppercase tracking-widest">New</span>}
                  {displayCustomer.status === 'churned' && <span className="text-[10px] px-2 py-1 bg-red-950 text-red-500 border border-red-900 rounded-sm font-bold uppercase tracking-widest">Churn</span>}
                </div>
              </div>

              {/* Vehicle List */}
              <div className="bg-[#1C1B1B] border border-[#2A2A2A] rounded-sm overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-[#2A2A2A]">
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Bike className="h-4 w-4 text-[#FFFF00]" />
                    Daftar Kendaraan
                  </h3>
                  <span className="text-[10px] font-bold bg-[#2A2A2A] text-slate-300 px-2 py-1 rounded-sm">
                    {displayCustomer.vehicles?.length || 0} UNIT
                  </span>
                </div>
                
                <div className="p-4">
                  {loading ? (
                    <div className="space-y-3">
                      {[1,2].map(i => <div key={i} className="h-16 bg-[#2A2A2A] animate-pulse rounded-sm" />)}
                    </div>
                  ) : displayCustomer.vehicles && displayCustomer.vehicles.length > 0 ? (
                    <div className="space-y-3">
                      {displayCustomer.vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="p-3 bg-[#131313] border border-[#2A2A2A] rounded-sm hover:border-[#FFFF00] transition-colors">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-white text-sm">
                                {vehicle.modelName}
                              </div>
                              <div className="flex gap-2 mt-1.5 items-center">
                                {vehicle.plateNumber && (
                                  <span className="font-technical text-[10px] font-bold bg-[#2A2A2A] text-slate-300 px-1.5 py-0.5 rounded-sm">
                                    {vehicle.plateNumber}
                                  </span>
                                )}
                                {vehicle.color && (
                                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                    {vehicle.color}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] border border-[#2A2A2A] bg-[#1C1B1B] text-slate-400 px-2 py-1 px-1 rounded-sm font-bold">
                              {vehicle.serviceCount}x Servis
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center py-6 border border-dashed border-[#2A2A2A] rounded-sm uppercase tracking-widest font-bold">
                      TIDAK ADA KENDARAAN
                    </div>
                  )}
                </div>
              </div>

              {/* Important Info */}
              <div className="bg-[#1C1B1B] border border-[#2A2A2A] rounded-sm p-4">
                 <h3 className="font-bold mb-4 text-white flex items-center gap-2 text-sm uppercase tracking-widest">
                   <Clock className="h-4 w-4 text-[#FFFF00]" />
                   Info Terakhir
                 </h3>
                 <div className="text-sm space-y-0 text-slate-300">
                    <div className="flex justify-between items-center py-3 border-b border-[#2A2A2A]">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Servis Terakhir</span>
                      <span className="font-technical font-bold text-white">{formatDate(displayCustomer.lastService)}</span>
                    </div>
                    {((displayCustomer as any).warranties || []).some((w: any) => w.status === 'ACTIVE') && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Garansi Aktif</span>
                        <span className="text-[10px] px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-sm font-bold uppercase tracking-widest">
                          ADA
                        </span>
                      </div>
                    )}
                 </div>
              </div>
            </TabsContent>

            {/* HISTORY TAB */}
            <TabsContent value="history" className="mt-0 outline-none">
               <ScrollArea className="h-[500px] pr-4 -mr-4">
                  <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-[#2A2A2A]">
                    {loading ? (
                      [1,2,3,4].map(i => <div key={i} className="h-24 bg-[#2A2A2A] animate-pulse rounded-sm" />)
                    ) : customerDetail?.bookings && customerDetail.bookings.length > 0 ? (
                      customerDetail.bookings.map((booking, idx) => (
                        <div key={booking.id} className="relative">
                          <div className={`absolute -left-[20px] top-1 w-3 h-3 rounded-full border-2 border-[#131313] ${
                            booking.status === 'COMPLETED' ? 'bg-emerald-500' : 
                            booking.status === 'CANCELLED' ? 'bg-slate-500' : 'bg-[#FFFF00]'
                          }`} />
                          <div className="bg-[#1C1B1B] p-4 rounded-sm border border-[#2A2A2A] hover:border-[#FFFF00] transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {formatDate(booking.bookingDate)}
                              </span>
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                                booking.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border-emerald-900' :
                                booking.status === 'CANCELLED' ? 'bg-slate-900 text-slate-400 border-slate-800' :
                                'bg-[#323200] text-[#FFFF00] border-[#FFFF00]/30'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            <div className="font-bold text-white text-sm mb-1.5">{booking.serviceType}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-technical">
                               <Bike className="h-3 w-3" />
                               {booking.vehicleModel} ({booking.plateNumber || '-'})
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        Belum ada riwayat servis
                      </div>
                    )}
                  </div>
               </ScrollArea>
            </TabsContent>

            {/* WARRANTY TAB */}
            <TabsContent value="warranty" className="mt-0 space-y-4 outline-none">
              {loading ? (
                <div className="h-40 bg-[#2A2A2A] animate-pulse rounded-sm" />
              ) : customerDetail?.warranties && customerDetail.warranties.length > 0 ? (
                <div className="space-y-4">
                  {customerDetail.warranties.map((warranty) => (
                    <div key={warranty.id} className={`bg-[#1C1B1B] rounded-sm border-l-2 overflow-hidden ${
                      warranty.status === 'ACTIVE' ? 'border-l-emerald-500 border-t border-b border-r border-[#2A2A2A]' : 
                      warranty.status === 'VOID' ? 'border-l-red-500 border-t border-b border-r border-[#2A2A2A]' : 
                      'border-l-slate-500 border-t border-b border-r border-[#2A2A2A]'
                    }`}>
                      <div className="py-3 px-4 bg-[#1C1B1B] border-b border-[#2A2A2A] flex flex-row items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest">
                             {warranty.type === 'Coating' ? <ShieldCheck className="h-4 w-4 text-sky-400" /> : <Clock className="h-4 w-4 text-[#FFFF00]" />}
                             Garansi {warranty.type}
                          </div>
                          <div className="text-[10px] text-slate-400 font-technical mt-1">
                            {warranty.vehicle} • {warranty.plateNumber}
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm border ${
                          warranty.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border-emerald-900' : 
                          warranty.status === 'VOID' ? 'bg-red-950 text-red-500 border-red-900' : 
                          'bg-slate-900 text-slate-400 border-slate-800'
                        }`}>
                          {warranty.status}
                        </span>
                      </div>
                      <div className="p-4 text-sm space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Tgl Mulai</div>
                            <div className="font-technical text-white text-xs">{formatDate(warranty.startDate)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Berakhir</div>
                            <div className="font-technical text-white text-xs">{formatDate(warranty.expiryDate)}</div>
                          </div>
                        </div>

                        {warranty.type === 'Coating' && (
                          <div className="pt-4 mt-2 border-t border-[#2A2A2A]">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-widest">
                                <Calendar className="h-3 w-3" /> Maint. Check
                              </span>
                              <span className="text-[10px] text-[#FFFF00] font-technical">Tiap 3 Bulan</span>
                            </div>
                            
                            <div className="flex justify-between gap-2 mt-2">
                               <div className="bg-[#131313] p-2.5 rounded-sm border border-[#2A2A2A] flex-1">
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Terakhir</div>
                                  <div className="text-xs font-technical text-slate-300">{formatDate(warranty.lastMaintenance || null)}</div>
                               </div>
                               <div className={`p-2.5 rounded-sm border flex-1 ${warranty.status === 'VOID' ? 'bg-red-950 border-red-900' : 'bg-[#131313] border-[#2A2A2A]'}`}>
                                  <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${warranty.status === 'VOID' ? 'text-red-400' : 'text-slate-500'}`}>Next Maint</div>
                                  <div className={`text-xs font-technical ${warranty.status === 'VOID' ? 'text-red-400' : 'text-[#FFFF00]'}`}>
                                     {warranty.status === 'VOID' ? 'VOID' : formatDate(warranty.nextMaintenance || null)}
                                  </div>
                               </div>
                            </div>
                            
                            {warranty.status === 'VOID' && (
                              <div className="mt-3 p-3 bg-red-950 text-red-400 text-[10px] rounded-sm border border-red-900 flex gap-2 items-start font-medium leading-relaxed">
                                 <AlertCircle className="h-4 w-4 shrink-0" />
                                 <span>Garansi hangus karena terlewat jadwal. Hubungi admin untuk aktivasi.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 border border-dashed border-[#2A2A2A] rounded-sm">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Tidak ada garansi aktif</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
