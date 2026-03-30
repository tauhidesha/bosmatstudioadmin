'use client';

import { useState, useEffect } from 'react';

export interface ServicePrice {
  id: string;
  size: string | null;
  vehicleModelId: string | null;
  price: number;
}

export interface Service {
  id: string;
  name: string;
  category: 'repaint' | 'detailing' | 'coating' | string;
  subcategory: string | null;
  summary: string | null;
  description: string | null;
  estimatedDuration: number;
  usesModelPricing: boolean;
  prices: ServicePrice[];
}

export interface VehicleModel {
  id: string;
  brand: string;
  modelName: string;
  serviceSize: string;
  repaintSize: string;
  aliases: string[];
}

export interface Surcharge {
  id: string;
  name: string;
  amount: number;
  aliases: string[];
}

export function usePricingData() {
  const [services, setServices] = useState<Service[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [svcRes, modelRes, surRes] = await Promise.all([
        fetch('/api/master-data/services'),
        fetch('/api/master-data/vehicle-models?limit=1000'),
        fetch('/api/master-data/surcharges'),
      ]);

      const svcData = await svcRes.json();
      const modelData = await modelRes.json();
      const surData = await surRes.json();

      if (svcData.success) setServices(svcData.services);
      if (modelData.success) setVehicleModels(modelData.models);
      if (surData.success) setSurcharges(surData.surcharges);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { 
    services, vehicleModels, surcharges, loading, error, refresh: fetchData,
    saveService: async (data: any) => {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/master-data/services/${data.id}` : '/api/master-data/services';
      const res = await fetch(url, { method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
      return res.json();
    },
    deleteService: async (id: string) => {
      const res = await fetch(`/api/master-data/services/${id}`, { method: 'DELETE' });
      return res.json();
    },
    saveModel: async (data: any) => {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/master-data/vehicle-models/${data.id}` : '/api/master-data/vehicle-models';
      const res = await fetch(url, { method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
      return res.json();
    },
    deleteModel: async (id: string) => {
      const res = await fetch(`/api/master-data/vehicle-models/${id}`, { method: 'DELETE' });
      return res.json();
    },
    saveSurcharge: async (data: any) => {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/master-data/surcharges/${data.id}` : '/api/master-data/surcharges';
      const res = await fetch(url, { method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
      return res.json();
    },
    deleteSurcharge: async (id: string) => {
      const res = await fetch(`/api/master-data/surcharges/${id}`, { method: 'DELETE' });
      return res.json();
    },
    saveModelPrice: async (data: { serviceId: string, vehicleModelId: string, price: number }) => {
      const res = await fetch('/api/master-data/prices', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    }
  };
}

export function calculateServicePrice(
  service: Service,
  motor: VehicleModel | null,
  surcharges: Surcharge[] = [],
  selectedSurchargeNames: string[] = []
): number {
  if (!service) return 0;

  let basePrice = 0;

  if (service.usesModelPricing && motor) {
    const priceEntry = service.prices?.find(p => p.vehicleModelId === motor.id);
    if (priceEntry) basePrice = priceEntry.price;
  }

  if (basePrice === 0 && motor) {
    const size = service.category === 'repaint' ? motor.repaintSize : motor.serviceSize;
    const priceEntry = service.prices?.find(p => p.size === size);
    if (priceEntry) basePrice = priceEntry.price;
  }

  if (basePrice === 0 && service.prices) {
    const priceEntry = service.prices.find(p => !p.size && !p.vehicleModelId);
    if (priceEntry) basePrice = priceEntry.price;
  }

  // Add surcharges
  let totalSurcharge = 0;
  selectedSurchargeNames.forEach(name => {
    const found = surcharges.find(s => s.name === name);
    if (found) totalSurcharge += found.amount;
  });

  return basePrice + totalSurcharge;
}

