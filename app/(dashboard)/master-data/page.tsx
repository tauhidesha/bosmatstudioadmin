'use client';

import { useState, useMemo } from 'react';
import { usePricingData, calculateServicePrice, type Service, type VehicleModel, type Surcharge } from '@/lib/hooks/usePricingData';
import { formatRupiah } from '@/lib/data/pricing';
import { cn } from '@/lib/utils';
import { useLayout } from '@/context/LayoutContext';
import React from 'react';
import { 
  Plus, Search, Settings, Wrench, Smartphone, 
  Palette, ShieldCheck, TrendingUp, Trash2, Edit 
} from 'lucide-react';
import MasterDataModal from './MasterDataModal';

export default function MasterDataPage() {
  const { 
    services, vehicleModels, surcharges, loading, refresh,
    saveService, deleteService, saveModel, deleteModel, saveSurcharge, deleteSurcharge
  } = usePricingData();
  const [activeTab, setActiveTab] = useState<'services' | 'models' | 'surcharges'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const { setHeaderTitle } = useLayout();

  React.useEffect(() => {
    setHeaderTitle('MASTER_DATA_MANAGEMENT');
    return () => setHeaderTitle('SYSTEM OVERVIEW');
  }, [setHeaderTitle]);

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredModels = vehicleModels.filter(m =>
    m.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSurcharges = surcharges.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data ini?')) return;
    try {
      if (activeTab === 'services') await deleteService(id);
      else if (activeTab === 'models') await deleteModel(id);
      else if (activeTab === 'surcharges') await deleteSurcharge(id);
      refresh();
    } catch (err) { alert('Gagal menghapus data'); }
  };

  const handleSave = async (data: any) => {
    if (activeTab === 'services') await saveService(data);
    else if (activeTab === 'models') await saveModel(data);
    else if (activeTab === 'surcharges') await saveSurcharge(data);
    refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#131313]">
        <div className="animate-spin size-10 border-4 border-[#FFFF00]/10 border-t-[#FFFF00] rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 bg-[#131313] min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline font-black text-[#FFFF00] uppercase tracking-tight text-2xl italic">
            DATABASE_CENTRAL
          </h1>
          <p className="text-white/40 font-headline text-[10px] uppercase tracking-widest mt-1">
            Single Source of Truth untuk Layanan, Harga, dan Kendaraan
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40 group-focus-within:text-[#FFFF00] transition-colors" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1C1B1B] border-none focus:ring-0 text-xs pl-10 pr-4 py-2.5 rounded-sm placeholder:text-white/20 text-white font-headline min-w-[240px]" 
              placeholder="Cari data..." 
              type="text"
            />
          </div>
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-[#FFFF00] text-[#131313] font-headline font-black text-xs uppercase tracking-widest px-5 h-10 flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Plus size={16} />
            TAMBAH
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0e0e0e] p-1 w-fit rounded-sm border border-white/5">
        {[
          { id: 'services', label: 'SERVICES', icon: Wrench },
          { id: 'models', label: 'VEHICLES', icon: Smartphone },
          { id: 'surcharges', label: 'SURCHARGES', icon: Palette },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 text-[10px] font-headline font-black uppercase tracking-widest transition-all",
              activeTab === tab.id ? "bg-[#FFFF00] text-[#131313]" : "text-white/40 hover:text-white"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[#1c1b1b] border border-white/5 rounded-sm overflow-hidden flex-1 flex flex-col">
        {activeTab === 'services' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0e0e0e]">
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Layanan</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Kategori</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Model Based</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Durasi</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em] text-right">Pricing</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em] text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredServices.map(svc => {
                  const basePrice = svc.prices.find(p => !p.size && !p.vehicleModelId)?.price || 0;
                  const sizePrices = svc.prices.filter(p => p.size).sort((a, b) => {
                    const order = { S: 1, M: 2, L: 3, XL: 4 };
                    return (order[a.size as keyof typeof order] || 0) - (order[b.size as keyof typeof order] || 0);
                  });

                  return (
                    <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-white uppercase">{svc.name}</p>
                        <p className="text-[10px] text-white/30 truncate max-w-xs">{svc.summary}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-white/5 text-white/60 text-[9px] font-black uppercase tracking-wider rounded-sm">
                          {svc.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         {svc.usesModelPricing ? (
                           <span className="text-[#FFFF00] flex items-center gap-1 text-[10px] font-black">
                             <ShieldCheck size={12} /> YA
                           </span>
                         ) : (
                           <span className="text-white/20 text-[10px] font-bold italic">TIDAK</span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-xs text-white/60 font-mono">
                        {svc.estimatedDuration} min
                      </td>
                      <td className="px-6 py-4 text-right">
                        {svc.usesModelPricing ? (
                          <p className="font-headline font-black text-sm text-white tracking-tight uppercase">By Model</p>
                        ) : sizePrices.length > 0 ? (
                          <div className="flex flex-col items-end gap-0.5">
                            {sizePrices.map(p => (
                              <p key={p.id} className="text-[10px] font-mono text-white/60">
                                <span className="text-[#FFFF00] font-bold">{p.size}:</span> {formatRupiah(p.price)}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="font-headline font-black text-sm text-white tracking-tight">
                            {formatRupiah(basePrice)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleEdit(svc)}
                            className="p-2 bg-white/5 text-white/40 hover:text-[#FFFF00] hover:bg-[#FFFF00]/10 transition-all rounded-sm"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(svc.id)}
                            className="p-2 bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all rounded-sm"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0e0e0e]">
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Model Name</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Brand</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Size (Service)</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Size (Repaint)</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em] text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredModels.map(model => (
                  <tr key={model.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-white uppercase">{model.modelName}</p>
                      <p className="text-[9px] text-white/20 mt-0.5">{model.aliases.join(', ')}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/60 uppercase font-black tracking-widest italic">
                      {model.brand}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-white/5 text-[#FFFF00] text-[10px] font-black rounded-sm border border-white/5">
                        {model.serviceSize}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-3 py-1 bg-white/5 text-[#FFFF00] text-[10px] font-black rounded-sm border border-white/5">
                        {model.repaintSize}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(model)}
                          className="p-2 bg-white/5 text-white/40 hover:text-[#FFFF00] hover:bg-[#FFFF00]/10 transition-all rounded-sm"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(model.id)}
                          className="p-2 bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all rounded-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'surcharges' && (
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0e0e0e]">
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Surcharge Name</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em]">Aliases</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em] text-right">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-headline font-black text-white/40 uppercase tracking-[0.2em] text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSurcharges.map(sur => (
                  <tr key={sur.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-bold text-sm text-white uppercase">{sur.name}</td>
                    <td className="px-6 py-4 text-[10px] text-white/30 italic truncate max-w-xs">{sur.aliases?.join(', ')}</td>
                    <td className="px-6 py-4 text-right font-headline font-black text-[#FFFF00] text-sm tracking-tight">{formatRupiah(sur.amount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(sur)}
                          className="p-2 bg-white/5 text-white/40 hover:text-[#FFFF00] hover:bg-[#FFFF00]/10 transition-all rounded-sm"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(sur.id)}
                          className="p-2 bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all rounded-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MasterDataModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={activeTab}
        editData={editingItem}
        onSave={handleSave}
        services={services}
      />
    </div>
  );
}
