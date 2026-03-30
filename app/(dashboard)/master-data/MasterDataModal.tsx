'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import { Service, VehicleModel, Surcharge } from '@/lib/hooks/usePricingData';
import { cn } from '@/lib/utils';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'services' | 'models' | 'surcharges';
  editData?: any;
  onSave: (data: any) => Promise<any>;
}

export default function MasterDataModal({ isOpen, onClose, type, editData, onSave }: MasterDataModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [sizePrices, setSizePrices] = useState<Record<string, string>>({
    S: '', M: '', L: '', XL: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData(editData);
        if (type === 'services' && editData.prices) {
          const prices: Record<string, string> = { S: '', M: '', L: '', XL: '' };
          editData.prices.forEach((p: any) => {
            if (p.size) prices[p.size] = p.price.toString();
          });
          setSizePrices(prices);
        }
      } else {
        // Defaults
        setSizePrices({ S: '', M: '', L: '', XL: '' });
        if (type === 'services') {
          setFormData({ name: '', category: 'detailing', usesModelPricing: false, estimatedDuration: 0 });
        } else if (type === 'models') {
          setFormData({ modelName: '', brand: '', serviceSize: 'M', repaintSize: 'M', aliases: [] });
        } else if (type === 'surcharges') {
          setFormData({ name: '', amount: 0, aliases: [] });
        }
      }
    }
  }, [isOpen, editData, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = { ...formData };
      
      // If service and not model-based, prepare the prices array
      if (type === 'services' && !formData.usesModelPricing) {
        dataToSave.prices = Object.entries(sizePrices)
          .filter(([_, price]) => price !== '')
          .map(([size, price]) => ({
            size,
            price: parseFloat(price)
          }));
      }

      await onSave(dataToSave);
      onClose();
    } catch (err) {
      alert('Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const renderServiceForm = () => (
    <div className="space-y-6">
      <div className="space-y-1">
        <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Service Name</label>
        <input 
          value={formData.name || ''} 
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm focus:ring-1 focus:ring-[#FFFF00]/50" 
          placeholder="e.g. Full Detailing Glossy"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Category</label>
          <select 
            value={formData.category || ''} 
            onChange={e => setFormData({ ...formData, category: e.target.value })}
            className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm"
          >
            <option value="repaint">Repaint</option>
            <option value="detailing">Detailing</option>
            <option value="coating">Coating</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Duration (Min)</label>
          <input 
            type="number"
            value={formData.estimatedDuration || 0} 
            onChange={e => setFormData({ ...formData, estimatedDuration: parseInt(e.target.value) })}
            className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm" 
          />
        </div>
      </div>

      <div className="flex items-center gap-3 bg-[#1c1b1b] p-4 rounded-sm border border-white/5">
        <input 
          type="checkbox"
          checked={formData.usesModelPricing || false}
          onChange={e => setFormData({ ...formData, usesModelPricing: e.target.checked })}
          className="size-4 accent-[#FFFF00]"
        />
        <div>
          <p className="text-xs font-bold text-white uppercase">Uses Model Pricing</p>
          <p className="text-[10px] text-white/40">Check if price varies by specific motorcycle model (Repaint Bodi Halus)</p>
        </div>
      </div>

      {!formData.usesModelPricing && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-white/5"></span>
            <span className="text-[9px] font-headline font-black text-white/30 uppercase tracking-widest">Size-Based Pricing (S/M/L/XL)</span>
            <span className="h-px flex-1 bg-white/5"></span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {['S', 'M', 'L', 'XL'].map(size => (
              <div key={size} className="space-y-1">
                <label className="text-[10px] font-headline text-[#FFFF00] uppercase tracking-widest">Price Size {size}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-bold">Rp</span>
                  <input 
                    type="number"
                    value={sizePrices[size]} 
                    onChange={e => setSizePrices({ ...sizePrices, [size]: e.target.value })}
                    className="w-full bg-[#0e0e0e] border-none text-sm p-3 pl-8 text-white rounded-sm focus:ring-1 focus:ring-[#FFFF00]/30" 
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderModelForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Brand</label>
          <input 
            value={formData.brand || ''} 
            onChange={e => setFormData({ ...formData, brand: e.target.value })}
            className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm" 
            placeholder="honda, yamaha..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Model Name</label>
          <input 
            value={formData.modelName || ''} 
            onChange={e => setFormData({ ...formData, modelName: e.target.value })}
            className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm" 
            placeholder="NMax, Vario..."
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Size (Service)</label>
          <select 
            value={formData.serviceSize || 'M'} 
            onChange={e => setFormData({ ...formData, serviceSize: e.target.value })}
            className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm"
          >
            {['S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Size (Repaint)</label>
          <select 
            value={formData.repaintSize || 'M'} 
            onChange={e => setFormData({ ...formData, repaintSize: e.target.value })}
            className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm"
          >
            {['S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderSurchargeForm = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Surcharge Name</label>
        <input 
          value={formData.name || ''} 
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-white rounded-sm" 
          placeholder="Candy Colors"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-headline text-white/40 uppercase tracking-widest">Amount (Rp)</label>
        <input 
          type="number"
          value={formData.amount || 0} 
          onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
          className="w-full bg-[#0e0e0e] border-none text-sm p-4 text-[#FFFF00] font-bold rounded-sm" 
        />
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? 'EDIT_RECORD' : 'ADD_RECORD'} size="md">
      <form onSubmit={handleSubmit} className="p-8 space-y-8 bg-[#131313]">
        {type === 'services' && renderServiceForm()}
        {type === 'models' && renderModelForm()}
        {type === 'surcharges' && renderSurchargeForm()}

        <div className="flex gap-4 pt-4">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-4 border border-white/10 text-white/40 font-headline font-black uppercase tracking-widest text-xs hover:text-white"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 py-4 bg-[#FFFF00] text-[#131313] font-headline font-black uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'SAVING...' : 'SAVE_DATA'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
