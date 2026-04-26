'use client';

import { useState, useMemo, useEffect } from 'react';
import { ApiClient } from '@/lib/api/client';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { formatRupiah } from '@/lib/data/pricing';
import { usePricingData, calculateServicePrice, type Service, type VehicleModel } from '@/lib/hooks/usePricingData';
import { cn } from '@/lib/utils';
import {
  X, Search, Check, Bolt, Smartphone, History, Verified,
  ChevronDown, PlusCircle, FileText, Wrench, HelpCircle,
  Minus, Plus, Trash2, Edit, UserPlus, MessageSquare
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';
import InvoicePreviewModal from './InvoicePreviewModal';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
}

interface ManualBookingFormProps {
  apiClient: ApiClient;
  allConversations: Conversation[];
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any; // To support edit
  onDelete?: (id: string) => Promise<any>;
  onUpdate?: (id: string, updates: any) => Promise<any>;
}

interface CartItem {
  id: string; // Unique ID for each item in cart
  name: string;
  price: number;
  surcharges: string[]; // Independent surcharges per item
  itemNotes?: string;
}

export default function ManualBookingForm({
  apiClient, allConversations, onSuccess, onCancel, initialData, onDelete, onUpdate
}: ManualBookingFormProps) {
  const { services, vehicleModels, surcharges, loading: loadingPricing } = usePricingData();
  const { getIdToken } = useAuth();
  const isEdit = !!initialData;
  // --- FORM STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [invoiceName, setInvoiceName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [motorcycleModel, setMotorcycleModel] = useState<VehicleModel | null>(null);
  const [modelSearchText, setModelSearchText] = useState('');
  const [platNomor, setPlatNomor] = useState('');
  const [bookingStatus, setBookingStatus] = useState<string>('pending');
  const [customModelSize, setCustomModelSize] = useState<'S' | 'M' | 'L' | 'XL'>('M');
  const [isWalkIn, setIsWalkIn] = useState(false);

  // --- SMART SEARCH STATE ---
  const [foundVehicle, setFoundVehicle] = useState<{ model: string, owner: string, phone: string, plate: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // TAMBAHAN BARU: State khusus untuk mencegah tabrakan pencarian
  const [skipNextSearch, setSkipNextSearch] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);

  const isCustomModel = modelSearchText.trim().length > 0 && motorcycleModel === null;
  const effectiveMotor = useMemo<VehicleModel | null>(() => 
    isCustomModel
      ? {
        id: '__custom__',
        brand: 'Custom',
        modelName: modelSearchText.trim(),
        serviceSize: customModelSize,
        repaintSize: customModelSize,
        aliases: [],
      }
      : motorcycleModel,
    [isCustomModel, modelSearchText, customModelSize, motorcycleModel]
  );

  useEffect(() => {
    if (motorcycleModel?.modelName) {
      setModelSearchText(motorcycleModel.modelName);
    }
  }, [motorcycleModel]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'repaint' | 'detailing' | 'coating'>('repaint');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [realPhone, setRealPhone] = useState('');

  // Sync realPhone if empty in Walk-In mode
  useEffect(() => {
    if (isWalkIn && contactPhone && !realPhone) {
      setRealPhone(contactPhone);
    }
  }, [isWalkIn, contactPhone, realPhone]);

  const handleToggleWalkIn = (val: boolean) => {
    setIsWalkIn(val);
    if (val) {
      // Chat WA -> WALK-IN
      setSelectedConversation(null);
      setFoundVehicle(null);
    } else {
      // WALK-IN -> Chat WA
      setInvoiceName('');
      setContactPhone('');
      setRealPhone('');
    }
  };

  // Custom Service state
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState<number>(0);

  // Spot Repair state
  const [spotCount, setSpotCount] = useState<number>(0);
  const [spotPrice, setSpotPrice] = useState<number>(100000);

  // Discount
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Logistics & Billing
  const [entryDate, setEntryDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  );
  const [timeSlot, setTimeSlot] = useState('10:00');
  const [homeService, setHomeService] = useState(false);
  const [dpRequired, setDpRequired] = useState(true);
  const [nominalDP, setNominalDP] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Transfer BCA');
  const [sendInvoiceWA, setSendInvoiceWA] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [docType, setDocType] = useState<string>('invoice');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Load draft from localStorage on mount (only for new bookings)
  useEffect(() => {
    if (!isEdit) {
      try {
        const saved = localStorage.getItem('booking-draft');
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.invoiceName) setInvoiceName(draft.invoiceName);
          if (draft.contactPhone) setContactPhone(draft.contactPhone);
          if (draft.realPhone) setRealPhone(draft.realPhone);
          if (draft.motorcycleModel) setMotorcycleModel(draft.motorcycleModel);
          if (draft.platNomor) setPlatNomor(draft.platNomor);
          if (draft.cart) setCart(draft.cart);
          if (draft.additionalNotes) setAdditionalNotes(draft.additionalNotes);
          if (draft.entryDate) setEntryDate(draft.entryDate);
          if (draft.timeSlot) setTimeSlot(draft.timeSlot);
          if (draft.spotCount) setSpotCount(draft.spotCount);
          if (draft.spotPrice) setSpotPrice(draft.spotPrice);
          if (draft.discountAmount) setDiscountAmount(draft.discountAmount);
          if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
          if (draft.homeService) setHomeService(draft.homeService);
          if (draft.nominalDP) setNominalDP(draft.nominalDP);
          if (draft.amountPaid) setAmountPaid(draft.amountPaid);
          if (draft.bookingStatus) setBookingStatus(draft.bookingStatus);
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveDraft = () => {
    setIsSavingDraft(true);
    try {
      const draft = {
        invoiceName, contactPhone, realPhone,
        motorcycleModel, platNomor, cart,
        additionalNotes, entryDate, timeSlot,
        spotCount, spotPrice, discountAmount,
        paymentMethod, homeService, nominalDP,
        amountPaid, bookingStatus,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('booking-draft', JSON.stringify(draft));
      alert('Draft berhasil disimpan!');
    } catch (e) {
      alert('Gagal menyimpan draft');
    } finally {
      setIsSavingDraft(false);
    }
  };



  // --- SMART SEARCH LOGIC (Untuk ngetik manual) ---
  useEffect(() => {
    // 1. Jika tameng aktif (karena baru klik dari sidebar), DIAM SAJA!
    if (skipNextSearch) return;

    // 2. Jika input kosong, DIAM SAJA! (jangan reset card yang ada)
    if (!platNomor || platNomor.trim() === '') return;

    const searchVehicle = async () => {
      const cleanPlate = platNomor.replace(/\s+/g, '');
      if (cleanPlate.length >= 4) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/vehicles?q=${cleanPlate}`);
          const json = await res.json();
          if (json.success && json.vehicles && json.vehicles.length > 0) {
            const v = json.vehicles[0];
            setFoundVehicle({
              model: v.modelName,
              owner: v.customer?.name || 'Unknown',
              phone: v.customer?.phone || '',
              plate: v.plateNumber || platNomor
            });

            // AUTO-APPLY FOR EDIT: If model is missing/generic, apply immediately
            if (isEdit && (!motorcycleModel || motorcycleModel.modelName.toLowerCase() === 'motor')) {
              const model = vehicleModels.find(m =>
                m.modelName.toLowerCase() === v.modelName.toLowerCase() ||
                v.modelName.toLowerCase().includes(m.modelName.toLowerCase())
              );
              if (model) {
                console.log('DEBUG: Auto-applied model from fetch:', model.modelName);
                setMotorcycleModel(model);
              }
            }
          } else {
            setFoundVehicle(null);
          }
        } catch (err) {
          console.error('Smart search error:', err);
        } finally {
          setIsSearching(false);
        }
      } else if (platNomor.length > 0 && platNomor.length < 4) {
        setFoundVehicle(null);
      }
    };

    const timer = setTimeout(searchVehicle, 500);
    return () => clearTimeout(timer);
  }, [platNomor, skipNextSearch]); // Jangan lupa tambahkan skipNextSearch di dependency

  // --- INITIAL POPULATION FOR EDIT ---
  useEffect(() => {
    if (initialData) {
      console.log('DEBUG: ManualBookingForm initialData:', initialData);
      setInvoiceName(initialData.customerName || '');
      setContactPhone(initialData.customerPhone || '');
      setRealPhone(initialData.realPhone || '');

      // Handle vehicle info properly
      const rawModel = initialData.vehicleModel || '';
      const rawInfo = initialData.vehicleInfo || '';
      const rawPlate = initialData.plateNumber || '';

      console.log('DEBUG: Matching model for:', { rawModel, rawInfo });

      // 1. Try to find model from vehicleModel field first (cleanest)
      let foundModel = vehicleModels.find(m =>
        m.modelName.toLowerCase() === rawModel.toLowerCase()
      );

      // 2. If not found, try extraction from vehicleInfo "Model (Plate)"
      if (!foundModel && rawInfo) {
        const extractedName = rawInfo.split(' (')[0].trim();
        foundModel = vehicleModels.find(m =>
          m.modelName.toLowerCase() === extractedName.toLowerCase() ||
          m.aliases?.some(a => a.toLowerCase() === extractedName.toLowerCase())
        );
      }

      // 3. Fallback: partial match if still not found
      if (!foundModel && (rawModel || rawInfo)) {
        const searchStr = (rawModel || rawInfo).toLowerCase();
        foundModel = vehicleModels.find(m =>
          searchStr.includes(m.modelName.toLowerCase()) ||
          m.aliases?.some(a => searchStr.includes(a.toLowerCase()))
        );
      }

      if (foundModel) {
        console.log('DEBUG: Found model:', foundModel.modelName);
        setMotorcycleModel(foundModel);
      }

      // Handle plate number
      const plateFromInfo = rawInfo.match(/\(([^)]+)\)/)?.[1] || '';
      const plateFinal = (rawPlate || plateFromInfo || '').replace(/-/g, '').trim();
      setPlatNomor(plateFinal);

      if (initialData.plateNumber) setPlatNomor(initialData.plateNumber.trim());

      // Handle dates (ISO string to YYYY-MM-DD)
      if (initialData.bookingDate) {
        const dateStr = typeof initialData.bookingDate === 'string'
          ? initialData.bookingDate.split('T')[0]
          : new Date(initialData.bookingDate).toISOString().split('T')[0];
        setEntryDate(dateStr);
      }

      if (initialData.bookingTime) setTimeSlot(initialData.bookingTime);

      // Handle Status and Payment History
      if (initialData.status) setBookingStatus(initialData.status.toLowerCase());
      if (initialData.amountPaid !== undefined) setAmountPaid(initialData.amountPaid);
      if (initialData.downPayment !== undefined) setNominalDP(initialData.downPayment);
      if (initialData.paymentMethod) setPaymentMethod(initialData.paymentMethod);
      if (initialData.homeService !== undefined) setHomeService(!!initialData.homeService);

      // Extract Discount
      const sub = Number(initialData.subtotal) || 0;
      const tot = Number(initialData.totalAmount);
      const discountRaw = Number(initialData.discount) || Number(initialData.discountAmount) || 0;

      if (discountRaw > 0) {
        setDiscountAmount(discountRaw);
      } else if (sub > 0 && !isNaN(tot) && tot < sub) {
        setDiscountAmount(sub - tot);
      } else {
        setDiscountAmount(0);
      }

      // Extract Additional Notes
      if (initialData.notes) {
        const notesParts = initialData.notes.split('Catatan Tambahan: ');
        if (notesParts.length > 1) {
          setAdditionalNotes(notesParts[1].trim());
        }
      }

      // Handle services population with Surcharges and Price Metadata
      // Use serviceTypeRaw if available (contains ||Price||Notes), otherwise fallback to services array
      const rawServiceString = (initialData as any).serviceTypeRaw || (Array.isArray(initialData.services) ? initialData.services.join(' § ') : initialData.services || '');
      const rawServices = rawServiceString ? rawServiceString.split(' § ') : [];

      if (rawServices.length > 0) {
        const newCart: any[] = [];
        let parsedSpotCount = 0;

        rawServices.forEach((s: string) => {
          let serviceLine = s.trim();
          if (!serviceLine) return;

          let itemSurcharges: string[] = [];
          let itemNotes = '';
          let explicitCustomPrice = 0;

          // 1. New Format: Name||Price||Notes
          if (serviceLine.includes('||')) {
            const [name, priceStr, notes] = serviceLine.split('||');
            serviceLine = name.trim();
            explicitCustomPrice = parseInt(priceStr) || 0;
            itemNotes = (notes || '').trim();
          } else {
            // 2. Legacy/Regex Format Fallbacks
            // Explicit Price [Rp...]
            const explicitPriceMatch = serviceLine.match(/ \[Rp(\d+)\]/);
            if (explicitPriceMatch) {
              explicitCustomPrice = parseInt(explicitPriceMatch[1]);
              serviceLine = serviceLine.replace(explicitPriceMatch[0], '').trim();
            }

            // Color/Notes (Warna: ...)
            const colorMatch = serviceLine.match(/ \(Warna: ([^)]+)\)/);
            if (colorMatch) {
              itemNotes = colorMatch[1].trim();
              serviceLine = serviceLine.replace(colorMatch[0], '').trim();
            }
          }

          // Parse surcharges format: "Service Name [+Surcharge1, +Surcharge2]" OR "Service Name (+Surcharge)"
          const surchargeMatch = serviceLine.match(/(.+) \[\+([^\]]+)\]/) || serviceLine.match(/(.+) \(\+([^)]+)\)/);
          if (surchargeMatch) {
            serviceLine = surchargeMatch[1].trim();
            itemSurcharges = surchargeMatch[2].split(',').map(sum => sum.trim().replace(/^\+/, ''));
          }

          const found = services.find(srv => srv.name === serviceLine);
          const itemId = Math.random().toString(36).substr(2, 9);

          if (found) {
            newCart.push({
              id: itemId,
              name: found.name,
              // Use explicit price from metadata if available, otherwise calculate
              price: explicitCustomPrice || calculateServicePrice(found, effectiveMotor || foundModel || null, surcharges, itemSurcharges),
              surcharges: itemSurcharges,
              itemNotes
            });
          } else if (serviceLine.startsWith('Spot Repair')) {
            const match = serviceLine.match(/Spot Repair \((\d+) spots\)/);
            if (match) {
              parsedSpotCount = parseInt(match[1]);
              setSpotCount(parsedSpotCount);
            }
            const spotServiceMaster = services.find(srv => srv.name === 'Spot Repair');
            if (spotServiceMaster) {
              newCart.push({
                id: itemId,
                name: spotServiceMaster.name,
                price: explicitCustomPrice || 0, // Prefer metadata price
                surcharges: []
              });
            }
          } else {
            // Check if it's a known service but name mismatch (case-insensitive)
            const looseMatch = services.find(srv => srv.name.toLowerCase() === serviceLine.toLowerCase());
            if (looseMatch) {
              newCart.push({
                id: itemId,
                name: looseMatch.name,
                price: explicitCustomPrice || calculateServicePrice(looseMatch, effectiveMotor || foundModel || null, surcharges, itemSurcharges),
                surcharges: itemSurcharges,
                itemNotes
              });
            } else {
              // Custom Service
              newCart.push({
                id: itemId,
                name: serviceLine,
                price: explicitCustomPrice || 0,
                surcharges: itemSurcharges,
                itemNotes,
                isCustom: explicitCustomPrice === 0 // If we have 0 and no metadata, it needs deduction
              });
            }
          }
        });

        // Deduce custom service price ONLY if price is still missing (Legacy support)
        const customItems = newCart.filter(i => i.isCustom);
        if (customItems.length > 0 && initialData.subtotal !== undefined) {
          let knownTotal = parsedSpotCount * 100000;
          newCart.forEach(item => {
            if (!item.isCustom && item.name !== 'Spot Repair') {
              knownTotal += (item.price || 0);
            }
          });

          const difference = Math.max(0, initialData.subtotal - knownTotal);
          if (difference > 0) {
            const firstCustom = newCart.find(i => i.isCustom);
            if (firstCustom) {
              firstCustom.price = difference;
              firstCustom.isCustom = false; // Mark as resolved
            }
          }
        }

        // Clean up temporary property
        const finalCart: CartItem[] = newCart.map(i => {
          const { isCustom, ...rest } = i;
          return rest as CartItem;
        });

        setCart(finalCart);
      }
    }
  }, [initialData, services, vehicleModels, surcharges]);

  // Recalculate cart prices when model or vehicle info changes
  useEffect(() => {
    setCart(prev => prev.map(item => {
      const serviceMaster = services.find(s => s.name === item.name);
      if (serviceMaster && item.name !== 'Spot Repair') {
        const newPrice = calculateServicePrice(serviceMaster, effectiveMotor, surcharges, item.surcharges || []);
        return { ...item, price: newPrice };
      }
      return item;
    }));
  }, [effectiveMotor, services, surcharges]);

  // --- ACTIONS ---
  const toggleSurchargeForItem = (itemId: string, surchargeName: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const hasSurcharge = item.surcharges.includes(surchargeName);
        const newSurcharges = hasSurcharge
          ? item.surcharges.filter(s => s !== surchargeName)
          : [...item.surcharges, surchargeName];

        // Recalculate price immediately for this item
        const serviceMaster = services.find(s => s.name === item.name);
        const newPrice = serviceMaster
          ? calculateServicePrice(serviceMaster, effectiveMotor, surcharges, newSurcharges)
          : item.price;

        return { ...item, surcharges: newSurcharges, price: newPrice };
      }
      return item;
    }));
  };

  const setItemNotesForItem = (itemId: string, notes: string) => {
    setCart(prev => prev.map(item => item.id === itemId ? { ...item, itemNotes: notes } : item));
  };

  // --- COMPUTED TOTALS ---
  const servicesTotal = useMemo(() => {
    const baseTotal = cart.reduce((sum: number, item: CartItem) => sum + item.price, 0);
    const spotTotal = spotCount * spotPrice;
    return baseTotal + spotTotal;
  }, [cart, spotCount, spotPrice]);

  const computedDiscount = useMemo(() => {
    if (discountPercent > 0) return Math.round(servicesTotal * (discountPercent / 100));
    return discountAmount;
  }, [servicesTotal, discountPercent, discountAmount]);

  const finalTotal = Math.max(0, servicesTotal - computedDiscount);
  const remainingBalance = Math.max(0, finalTotal - Math.max(amountPaid, dpRequired ? nominalDP : 0));

  // --- ACTIONS ---
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setContactPhone(conv.customerPhone);
    setInvoiceName(conv.customerName || '');

    // AKTIFKAN TAMENG: Jangan pedulikan perubahan platNomor setelah ini
    setSkipNextSearch(true);
    setPlatNomor('');

    // AUTO-SEARCH: Cari kendaraan pelanggan pakai No WA! (Bersihkan karakter non-digit)
    if (conv.customerPhone) {
      setIsSearching(true);
      const cleanSearch = conv.customerPhone.replace(/[^0-9]/g, '');
      try {
        const res = await fetch(`/api/vehicles?q=${cleanSearch}`);
        const json = await res.json();

        if (json.success && json.vehicles && json.vehicles.length > 0) {
          const v = json.vehicles[0];
          setFoundVehicle({
            model: v.modelName,
            owner: v.customer?.name || conv.customerName || 'Unknown',
            phone: v.customer?.phone || conv.customerPhone,
            plate: v.plateNumber || ''
          });
        } else {
          setFoundVehicle(null);
        }
      } catch (err) {
        console.error('Auto-search vehicle error:', err);
      } finally {
        setIsSearching(false);
        // MATIKAN TAMENG setelah pencarian dari sidebar selesai
        setTimeout(() => setSkipNextSearch(false), 500);
      }
    } else {
      setSkipNextSearch(false);
    }
  };

  const addServiceToCart = (service: Service) => {
    const defaultSurcharges: string[] = [];
    const price = calculateServicePrice(service, effectiveMotor, surcharges, defaultSurcharges);

    setCart((prev: CartItem[]) => {
      if (prev.find((i: CartItem) => i.name === service.name)) {
        return prev.filter((i: CartItem) => i.name !== service.name);
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        name: service.name,
        price,
        surcharges: defaultSurcharges
      }];
    });
  };

  const addCustomService = () => {
    if (!customServiceName || customServicePrice <= 0) return;
    setCart((prev: CartItem[]) => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: customServiceName.toUpperCase(),
      price: customServicePrice,
      surcharges: []
    }]);
    setCustomServiceName('');
    setCustomServicePrice(0);
  };

  const handleSubmit = async () => {
    if (!invoiceName || !contactPhone || (!motorcycleModel && !modelSearchText.trim())) {
      alert('Mohon lengkapi info customer dan model motor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const serviceSummary = [
        ...cart
          .filter((i: CartItem) => i.name !== 'Spot Repair')
          .map((i: CartItem) => {
            let nameWithSurcharges = i.name;
            if (i.surcharges && i.surcharges.length > 0) {
              nameWithSurcharges = `${i.name} (+${i.surcharges.join(', ')})`;
            }
            // Format: Name (Surcharges)||Price||Notes
            return `${nameWithSurcharges}||${i.price}||${i.itemNotes ? `Warna: ${i.itemNotes}` : ''}`;
          }),
        spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
      ].filter(Boolean).join(' § ');

      const payload = {
        customerId: selectedConversation?.customerId,
        customerName: invoiceName,
        customerPhone: contactPhone,
        serviceName: serviceSummary,
        bookingDate: entryDate,
        bookingTime: timeSlot,
        vehicleInfo: `${effectiveMotor?.modelName || modelSearchText.trim()} (${platNomor || '-'})`,
        motorModel: effectiveMotor?.modelName || modelSearchText.trim(),
        plateNumber: platNomor,
        subtotal: servicesTotal,
        discount: computedDiscount,
        totalAmount: finalTotal,
        downPayment: nominalDP,
        amountPaid: amountPaid,
        status: bookingStatus,
        homeService,
        realPhone,
        notes: `Layanan: ${cart.map((i: CartItem) => {
          const isKnown = services.some(s => s.name === i.name) || i.name === 'Spot Repair';
          const baseName = isKnown ? i.name : `${i.name} [Rp${i.price}]`;
          let result = baseName;
          if (i.surcharges.length > 0) result += ` (+${i.surcharges.join(', ')})`;
          if (i.itemNotes) result += ` (Warna: ${i.itemNotes})`;
          return result;
        }).join(', ')} ${spotCount > 0 ? `| Spot Repair (${spotCount} spots)` : ''} | DP: ${paymentMethod} \n\nCatatan Tambahan: ${additionalNotes}${isCustomModel ? `\n\n[Custom Model - Size: ${customModelSize}]` : ''}`,
      };

      if (isEdit) {
        if (onUpdate) await onUpdate(initialData.id, payload);
      } else {
        const token = await getIdToken();
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Gagal membuat booking');
      }

      if (sendInvoiceWA) {
        // Prepare items with prices for the template
        const detailedItems = [
          ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
          spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
        ].filter(Boolean).join('\n');

        const token = await getIdToken();
        await fetch('/api/bookings/invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            documentType: docType,
            customerName: invoiceName,
            customerPhone: contactPhone,
            realPhone,
            motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
            items: detailedItems,
            subtotal: servicesTotal,
            totalAmount: finalTotal,
            discount: computedDiscount,
            amountPaid: amountPaid,
            downPayment: nominalDP,
            paymentMethod: paymentMethod,
            notes: `Layanan:\n${serviceSummary.replace(/ § /g, '\n')}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
            bookingDate: entryDate,
          }),
        });
      }

      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !initialData?.id) return;
    if (confirm('APAKAH ANDA YAKIN INGIN MENGHAPUS BOOKING INI? DATA TIDAK DAPAT DIKEMBALIKAN.')) {
      setIsSubmitting(true);
      try {
        await onDelete(initialData.id);
        onSuccess();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const layoutProps = {
    isEdit, currentStep, setCurrentStep,
    selectedConversation, setSelectedConversation,
    invoiceName, setInvoiceName,
    contactPhone, setContactPhone,
    motorcycleModel, setMotorcycleModel,
    platNomor, setPlatNomor,
    activeTab, setActiveTab,
    cart, addServiceToCart,
    customServiceName, setCustomServiceName,
    customServicePrice, setCustomServicePrice,
    addCustomService,
    spotCount, setSpotCount,
    spotPrice, setSpotPrice,
    discountPercent, setDiscountPercent,
    discountAmount, setDiscountAmount,
    entryDate, setEntryDate,
    timeSlot, setTimeSlot,
    homeService, setHomeService,
    dpRequired, setDpRequired,
    nominalDP, setNominalDP,
    isSubmitting, paymentMethod, setPaymentMethod,
    sendInvoiceWA, setSendInvoiceWA,
    showInvoicePreview, setShowInvoicePreview,
    isSavingDraft, handleSaveDraft,
    foundVehicle, setFoundVehicle, isSearching,
    handleSubmit, handleDelete, handleSelectConversation, toggleSurchargeForItem, setItemNotesForItem,
    onCancel, servicesTotal, computedDiscount, finalTotal, remainingBalance,
    allConversations, skipNextSearch, setSkipNextSearch,
    showAllChats, setShowAllChats,
    bookingStatus, setBookingStatus, amountPaid, setAmountPaid,
    docType, setDocType,
    services, vehicleModels, surcharges, loadingPricing,
    additionalNotes, setAdditionalNotes,
    realPhone, setRealPhone,
    modelSearchText, setModelSearchText,
    isWalkIn, handleToggleWalkIn,
    isCustomModel, customModelSize, setCustomModelSize, effectiveMotor, setCart,
    getIdToken,
  };

  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <MobileLayout {...layoutProps} /> : <DesktopLayout {...layoutProps} />;
}

// ── MOBILE LAYOUT ──
function MobileLayout(props: any) {
  const {
    isEdit, currentStep, setCurrentStep,
    selectedConversation, invoiceName, setInvoiceName,
    contactPhone, setContactPhone, motorcycleModel, setMotorcycleModel,
    modelSearchText, setModelSearchText,
    platNomor, setPlatNomor, activeTab, setActiveTab, cart, addServiceToCart,
    customServiceName, setCustomServiceName, customServicePrice, setCustomServicePrice,
    addCustomService, spotCount, setSpotCount, spotPrice, setSpotPrice,
    discountPercent, setDiscountPercent, discountAmount, setDiscountAmount,
    entryDate, setEntryDate, timeSlot, setTimeSlot, homeService, setHomeService,
    dpRequired, setDpRequired, nominalDP, setNominalDP, isSubmitting, paymentMethod, setPaymentMethod,
    sendInvoiceWA, setSendInvoiceWA, showInvoicePreview, setShowInvoicePreview,
    isSavingDraft, handleSaveDraft,
    foundVehicle, setFoundVehicle, isSearching,
    handleSubmit, handleDelete, handleSelectConversation, onCancel, getIdToken,
    servicesTotal, computedDiscount, finalTotal, remainingBalance, allConversations,
    skipNextSearch, setSkipNextSearch, showAllChats, setShowAllChats,
    bookingStatus, setBookingStatus, amountPaid, setAmountPaid,
    docType, setDocType,
    services, vehicleModels, surcharges, loadingPricing,
    toggleSurchargeForItem, setItemNotesForItem, additionalNotes, setAdditionalNotes,
    realPhone, setRealPhone,
    isWalkIn, handleToggleWalkIn,
    isCustomModel, customModelSize, setCustomModelSize, effectiveMotor, setCart
  } = props;


  const isSpotRepairSelected = cart.some((item: CartItem) => item.name === 'Spot Repair');

  return (
    <div className="fixed inset-0 z-[60] bg-[#131313] flex flex-col font-body h-screen overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-neutral-950/60 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-6 h-16">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-white active:scale-95 transition-all">
            <X className="text-[#FFFF00] size-6" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-spartan italic font-bold text-white tracking-tighter leading-none uppercase">
              {isEdit ? 'EDIT_MISSION' : 'NEW_MISSION'}
            </h1>
            <span className="text-[10px] text-neutral-400 font-headline tracking-widest uppercase">booking input interface</span>
          </div>
        </div>
        <HelpCircle className="text-neutral-400 size-5" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 space-y-8 no-scrollbar scroll-smooth pb-40">
        {/* Section 1: Customer & Invoice */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Customer & Invoice</h2>
          </div>
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex bg-neutral-900 overflow-hidden rounded-sm p-1 border border-white/5">
              <button
                onClick={() => handleToggleWalkIn(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all",
                  !isWalkIn ? "bg-[#FFFF00] text-black" : "text-neutral-500 hover:text-white"
                )}
              >
                <MessageSquare size={12} className={cn(!isWalkIn ? "fill-current" : "")} />
                DARI CHAT WA
              </button>
              <button
                onClick={() => handleToggleWalkIn(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all",
                  isWalkIn ? "bg-[#FFFF00] text-black" : "text-neutral-500 hover:text-white"
                )}
              >
                <UserPlus size={12} className={cn(isWalkIn ? "fill-current" : "")} />
                WALK-IN
              </button>
            </div>

            {!isWalkIn && (
              <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1 ml-1">WhatsApp Quick Select</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {(showAllChats ? allConversations : allConversations.slice(0, 5)).map((conv: Conversation) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "flex-shrink-0 p-3 flex flex-col gap-1 border transition-all rounded-sm min-w-32",
                      selectedConversation?.id === conv.id
                        ? "bg-[#FFFF00]/10 border-[#FFFF00]/50"
                        : "bg-surface-container-low border-white/5"
                    )}
                  >
                    <p className="text-[10px] font-bold text-white uppercase truncate text-left">{conv.customerName || 'No Name'}</p>
                    <p className="text-[8px] text-slate-500">Active Chat</p>
                  </button>
                ))}
                <button
                  onClick={() => setShowAllChats(!showAllChats)}
                  className="flex-shrink-0 p-3 flex flex-col items-center justify-center gap-1 border border-dashed border-white/10 text-slate-500 hover:text-white transition-all rounded-sm min-w-16 bg-surface-container-low"
                >
                  <Search className="size-4" />
                  <span className="text-[8px] font-headline uppercase">{showAllChats ? 'Less' : 'More'}</span>
                </button>
              </div>
            </div>
            )}

            <div className="space-y-4 bg-neutral-900/40 p-4 rounded-sm border border-white/5">
              <div className="group">
                <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1">
                  {isWalkIn ? 'Nama Customer (Manual)' : 'Invoice name (Display Name)'}
                </label>
                <input
                  value={invoiceName}
                  onChange={e => setInvoiceName(e.target.value)}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-3 px-4 text-white placeholder-neutral-700"
                  type="text"
                />
              </div>
              <div className="group">
                <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1">
                  {isWalkIn ? 'Nomor HP (Manual)' : 'Contact Phone (WA ID)'}
                </label>
                <input
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-3 px-4 text-white placeholder-neutral-700 font-mono"
                  type="tel"
                />
              </div>
              <div className={cn("group animate-in fade-in slide-in-from-top-1 duration-300", isWalkIn ? "block" : "hidden")}>
                <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1">No. WA untuk Invoice</label>
                <input
                  value={realPhone}
                  onChange={e => setRealPhone(e.target.value)}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-3 px-4 text-white placeholder-neutral-700 font-mono"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Technical Specs */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Technical Specs</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-headline text-slate-500 uppercase ml-1">Motorcycle Model</label>
              <div className="relative">
                <input
                  list="motorcycle-models-mobile"
                  value={modelSearchText}
                  onChange={e => {
                    setModelSearchText(e.target.value);
                    const model = vehicleModels.find(m => m.modelName.toLowerCase() === e.target.value.toLowerCase());
                    setMotorcycleModel(model || null);
                  }}
                  onBlur={() => {
                    if (!motorcycleModel || motorcycleModel.modelName.toLowerCase() !== modelSearchText.toLowerCase()) {
                      // If no strict match and we have text, try to find partial match
                      const model = vehicleModels.find(m => m.modelName.toLowerCase().includes(modelSearchText.toLowerCase()));
                      if (model) setMotorcycleModel(model);
                    }
                  }}
                  className="w-full bg-neutral-900 border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-3 px-3 text-white placeholder-neutral-700"
                  placeholder="Type to search model..."
                />
                <datalist id="motorcycle-models-mobile">
                  {vehicleModels.map(m => (
                    <option key={m.id} value={m.modelName}>{m.modelName}</option>
                  ))}
                </datalist>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 size-3 pointer-events-none" />
              </div>
              {isCustomModel && !motorcycleModel && (
                <button
                  type="button"
                  onClick={() => (document.activeElement as HTMLElement)?.blur()}
                  className="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-[#FFFF00] bg-[#FFFF00]/10 px-2 py-1 rounded-sm border border-[#FFFF00]/20"
                >
                  <PlusCircle size={10} />
                  USE CUSTOM: {modelSearchText.trim().toUpperCase()}
                </button>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-headline text-slate-500 uppercase ml-1">Plate Number</label>
              <div className="relative">
                <input
                  value={platNomor}
                  onChange={e => setPlatNomor(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-900 border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-3 px-4 text-white uppercase font-bold tracking-widest"
                  type="text"
                />
                <div className="absolute right-2 bottom-[-14px]">
                  <span className="text-[8px] font-headline text-[#FFFF00] bg-black/80 px-1 py-0.5 rounded-sm border border-[#FFFF00]/30 shadow-lg">SMART SEARCH</span>
                </div>
              </div>
            </div>
          </div>

          {isCustomModel && (
            <div className="bg-neutral-900/60 p-4 border border-[#FFFF00]/20 rounded-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#FFFF00] text-black text-[9px] font-black uppercase rounded-sm">Custom Model</span>
                  <HelpCircle className="size-3 text-neutral-500" />
                </div>
                <p className="text-[9px] text-neutral-400 font-headline italic">Pilih ukuran yang paling mendekati</p>
              </div>

              <div className="flex gap-1 bg-neutral-950 p-1 rounded-sm">
                {(['S', 'M', 'L', 'XL'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCustomModelSize(size)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold rounded-sm transition-all",
                      customModelSize === size ? "bg-[#FFFF00] text-black" : "text-neutral-500"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {foundVehicle && (
            <div className="p-3 bg-[#FFFF00]/5 border border-[#FFFF00]/20 flex items-center justify-between rounded-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <Bolt className="size-4 text-[#FFFF00]" />
                <div>
                  <p className="text-[10px] font-bold text-white uppercase">{foundVehicle.model}</p>
                  <p className="text-[9px] text-zinc-500 uppercase">OWNER: {foundVehicle.owner}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const model = vehicleModels.find(m => m.modelName.toLowerCase() === foundVehicle.model.toLowerCase() || foundVehicle.model.toLowerCase().includes(m.modelName.toLowerCase()));
                  if (model) setMotorcycleModel(model);
                  if (!invoiceName) setInvoiceName(foundVehicle.owner);
                  if (!contactPhone) setContactPhone(foundVehicle.phone);
                  setPlatNomor(foundVehicle.plate);
                }}
                className="px-3 py-1 bg-[#FFFF00] text-black font-headline text-[9px] font-black uppercase"
              >
                USE_MISSION_DATA
              </button>
            </div>
          )}
        </section>

        {/* Section 3: Service Selection */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Service Selection</h2>
          </div>

          <div className="flex gap-1 bg-neutral-900/50 p-1 rounded-sm border border-white/5">
            {(['repaint', 'detailing', 'coating'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 text-[10px] font-spartan font-bold tracking-tighter uppercase transition-all",
                  activeTab === tab ? "bg-[#FFFF00] text-black" : "text-neutral-500"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {services.filter(s => s.category === activeTab).map((service: Service) => {
              const selected = cart.some((i: CartItem) => i.name === service.name);
              const price = calculateServicePrice(service, effectiveMotor, surcharges);
              return (
                <div
                  key={service.id}
                  onClick={() => addServiceToCart(service)}
                  className={cn(
                    "p-4 flex items-center justify-between transition-all border border-white/5 rounded-sm",
                    selected ? "bg-neutral-800 border-r-4 border-r-[#FFFF00]" : "bg-neutral-900/40 opacity-70"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-sm", selected ? "bg-[#FFFF00]/10" : "bg-neutral-800")}>
                      <Bolt className={cn("size-4", selected ? "text-[#FFFF00]" : "text-neutral-400")} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-tight">{service.name}</p>
                      <p className={cn("text-[9px] font-headline", selected ? "text-[#FFFF00]" : "text-neutral-500")}>
                        IDR {price > 0 ? (price / 1000).toFixed(0) + 'K' : 'Manual'}
                      </p>
                    </div>
                  </div>
                  {selected ? <Check className="text-[#FFFF00] size-4" /> : <div className="size-4 border border-neutral-700 rounded-full" />}
                </div>
              );
            })}

            <div className="bg-neutral-900/20 p-4 border border-dashed border-neutral-800 space-y-3 rounded-sm">
              <div className="flex items-center gap-2">
                <PlusCircle className="text-[#FFFF00] size-4" />
                <p className="text-[10px] font-bold text-neutral-400 uppercase">ADD CUSTOM SERVICE</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={customServiceName}
                  onChange={e => setCustomServiceName(e.target.value)}
                  className="flex-1 bg-neutral-900 border-none focus:ring-0 text-xs py-2 px-3 text-white placeholder-neutral-700 italic"
                  placeholder="Service Name"
                />
                <input
                  type="text"
                  value={customServicePrice > 0 ? customServicePrice.toLocaleString('id-ID') : ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                    setCustomServicePrice(val ? Number(val) : 0);
                  }}
                  className="w-20 bg-neutral-900 border-none focus:ring-0 text-xs py-2 px-3 text-white placeholder-neutral-700 italic text-right font-mono"
                  placeholder="Price"
                />
                <button onClick={addCustomService} className="bg-[#FFFF00] text-black px-3 rounded-sm active:scale-95 transition-all">
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Cart Items with Per-Item Surcharges (Mobile) */}
            <div className="space-y-4">
              {cart.map((item: CartItem) => {
                const isBodiHalus = item.name.toUpperCase().includes('BODI HALUS');
                const isVelg = item.name.toUpperCase().includes('VELG');
                const isCvtArm = item.name.toUpperCase().includes('CVT') || item.name.toUpperCase().includes('ARM');

                // Only show surcharge section if it's Bodi Halus, Velg or CVT/Arm
                if (!isBodiHalus && !isVelg && !isCvtArm) return null;

                const availableSurcharges = surcharges.filter((s: any) => {
                  const isChromeOrTwoTone = s.name.toUpperCase().includes('CHROME') || s.name.toUpperCase().includes('TWO TONE');
                  if (isVelg) return isChromeOrTwoTone;
                  if (isBodiHalus) return !isChromeOrTwoTone;
                  return false;
                });

                return (
                  <div key={item.id} className="bg-neutral-900/40 p-4 border border-white/5 space-y-3 rounded-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2">
                      <Wrench className="text-[#FFFF00] size-4" />
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter italic">
                        SETTINGS FOR: {item.name}
                      </p>
                    </div>
                    {availableSurcharges.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 pb-3 mb-1 border-b border-white/5">
                        {availableSurcharges.map((s: any) => (
                          <label key={s.id} className="flex items-center gap-3 cursor-pointer p-2 bg-neutral-900 border border-white/5 rounded-sm">
                            <input
                              type="checkbox"
                              checked={item.surcharges.includes(s.name)}
                              onChange={() => toggleSurchargeForItem(item.id, s.name)}
                              className="rounded border-white/10 bg-[#0e0e0e] text-[#FFFF00] focus:ring-[#FFFF00] size-4"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white uppercase">{s.name}</span>
                              <span className="text-[10px] text-slate-500">{s.isPercentage ? `${s.amount}%` : formatRupiah(s.amount)}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[9px] font-headline text-neutral-500 uppercase">Catatan Warna / Detail</label>
                      <input
                        type="text"
                        value={item.itemNotes || ''}
                        onChange={(e) => setItemNotesForItem(item.id, e.target.value)}
                        placeholder="Misal: Warna merah candy tone..."
                        className="w-full bg-[#0e0e0e] border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-2 px-3 text-white placeholder-neutral-700 rounded-sm"
                      />
                    </div>

                    {/* Manual Price Fallback for Custom Repaint */}
                    {isCustomModel && item.name === 'Repaint Bodi Halus' && item.price === 0 && (
                      <div className="space-y-1 pt-2 border-t border-white/5 mt-2">
                        <label className="text-[9px] font-headline text-[#FFFF00] uppercase">Harga Manual (Model tidak terdaftar)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500 font-headline">IDR</span>
                          <input
                            type="text"
                            value={item.price > 0 ? item.price.toLocaleString('id-ID') : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                              const num = val ? Number(val) : 0;
                              setCart(prev => prev.map(i => i.id === item.id ? { ...i, price: num } : i));
                            }}
                            className="w-full bg-[#FFFF00]/5 border border-[#FFFF00]/20 text-xs py-2 pl-8 pr-3 text-[#FFFF00] font-mono rounded-sm"
                            placeholder="Input Harga Manual..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


            {/* Manual Adjust - Only show if Spot Repair is selected */}
            {isSpotRepairSelected && (
              <div className="bg-neutral-900/40 p-4 border border-white/5 space-y-4 rounded-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className="text-neutral-500 size-4" />
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter italic">SPOT REPAIR / MANUAL ADJUST</p>
                  </div>
                  <div className="flex items-center gap-3 bg-neutral-900 px-2 py-1 rounded-sm border border-white/10">
                    <button onClick={() => setSpotCount((prev: number) => Math.max(0, prev - 1))} className="text-neutral-500"><Minus size={14} /></button>
                    <span className="text-xs font-bold text-white font-mono">{spotCount.toString().padStart(2, '0')}</span>
                    <button onClick={() => setSpotCount((prev: number) => prev + 1)} className="text-[#FFFF00]"><Plus size={14} /></button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-headline">IDR</span>
                  <input
                    type="text"
                    value={spotPrice > 0 ? spotPrice.toLocaleString('id-ID') : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                      setSpotPrice(val ? Number(val) : 0);
                    }}
                    className="w-full bg-neutral-900 border-none focus:ring-0 text-xs py-2 pl-10 pr-4 text-white placeholder-neutral-700 italic"
                    placeholder="Price Field"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Discount */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Discount Settings</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 bg-neutral-900/40 p-4 rounded-sm border border-white/5">
            <div className="space-y-1">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Percentage (%)</label>
              <div className="relative">
                <input
                  value={discountPercent || ''}
                  onChange={e => { setDiscountPercent(Number(e.target.value)); setDiscountAmount(0); }}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-2 px-3 text-white text-right font-mono"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Fixed Amount (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500 font-headline">IDR</span>
                <input
                  type="text"
                  value={discountAmount > 0 ? discountAmount.toLocaleString('id-ID') : ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                    setDiscountAmount(val ? Number(val) : 0);
                    setDiscountPercent(0);
                  }}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-2 pl-8 pr-3 text-white text-right font-mono"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Logistics & Billing */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Logistics & Billing</h2>
          </div>
          <div className="bg-neutral-900/40 p-4 rounded-sm border border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[9px] font-headline text-neutral-500 uppercase">Down Payment</label>
                <div className="flex bg-neutral-950 p-1 rounded-sm">
                  <button onClick={() => setDpRequired(true)} className={cn("flex-1 py-1.5 text-[10px] font-spartan font-bold rounded-sm transition-all", dpRequired ? "bg-[#FFFF00] text-black" : "text-neutral-500")}>YA</button>
                  <button onClick={() => setDpRequired(false)} className={cn("flex-1 py-1.5 text-[10px] font-spartan font-bold rounded-sm transition-all", !dpRequired ? "bg-[#FFFF00] text-black" : "text-neutral-500")}>TIDAK</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] font-headline text-neutral-500 uppercase">Nominal DP (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500 font-headline">IDR</span>
                  <input
                    type="text"
                    value={nominalDP > 0 ? nominalDP.toLocaleString('id-ID') : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                      setNominalDP(val ? Number(val) : 0);
                    }}
                    className="w-full bg-neutral-950 border-none focus:ring-0 text-sm py-2 pl-8 pr-3 text-white text-right font-mono"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Metode Pembayaran</label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-neutral-950 border-none focus:ring-0 text-sm py-2.5 px-3 text-white appearance-none cursor-pointer font-body"
                >
                  <option>Tunai</option>
                  <option>Transfer BCA</option>
                  <option>QRIS</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 size-4 pointer-events-none" />
              </div>
            </div>

            {/* Additional Notes (Mobile) */}
            <div className="space-y-1 pt-2">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Catatan Tambahan (Warna, dll)</label>
              <textarea
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                className="w-full bg-neutral-950 border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-3 px-3 text-white placeholder-neutral-700 resize-none rounded-sm"
                placeholder="Misal: Warna merah candy tone, velg black glossy..."
                rows={3}
              />
            </div>
          </div>

          {/* Status & Transaction (Mobile) */}
          {isEdit && (
            <div className="bg-neutral-900/40 p-5 space-y-4 rounded-sm border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-4 bg-[#FFFF00]"></span>
                <h3 className="font-spartan text-xs font-bold uppercase text-white tracking-widest italic">Status & Transaction</h3>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(['pending', 'in_progress', 'done', 'paid'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setBookingStatus(s);
                        if (s === 'paid') setAmountPaid(finalTotal);
                      }}
                      className={cn(
                        "py-2 text-[9px] font-black uppercase border rounded-sm transition-all",
                        bookingStatus === s
                          ? "bg-[#FFFF00] text-black border-[#FFFF00]"
                          : "bg-neutral-950 text-neutral-500 border-white/5"
                      )}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-headline text-neutral-500 uppercase">Total Paid (Historical)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500 font-headline">IDR</span>
                    <input
                      type="text"
                      value={amountPaid > 0 ? amountPaid.toLocaleString('id-ID') : ''}
                      onChange={e => {
                        const valStr = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                        const val = valStr ? Number(valStr) : 0;
                        setAmountPaid(val);
                        if (val >= finalTotal && finalTotal > 0) setBookingStatus('paid');
                      }}
                      className="w-full bg-neutral-950 border-none focus:ring-0 text-sm py-2 pl-8 pr-3 text-[#FFFF00] text-right font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-neutral-800/80 p-5 space-y-3 relative overflow-hidden rounded-sm border border-[#FFFF00]/10">
            {cart.length > 0 && (
              <div className="space-y-2 mb-3 pb-3 border-b border-white/10">
                {cart.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addServiceToCart({ name: item.name } as any)}
                        className="text-red-500 bg-red-500/10 p-0.5 rounded-sm"
                      >
                        <X size={10} />
                      </button>
                      <span className="text-neutral-300 font-headline uppercase truncate max-w-[180px]">
                        {item.name} {item.name === 'Spot Repair' && spotCount > 0 ? `(${spotCount}x)` : ''}
                      </span>
                    </div>
                    <span className="text-neutral-400 font-medium font-mono">
                      {item.name === 'Spot Repair' ? formatRupiah(spotCount * spotPrice) : formatRupiah(item.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-headline">Services total</span>
              <span className="text-white font-medium">{formatRupiah(servicesTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-headline">Discount</span>
              <span className="text-red-500 font-medium">- {formatRupiah(computedDiscount)}</span>
            </div>
            <div className="pt-3 mt-1 border-t border-white/10 flex justify-between items-end">
              <span className="text-[10px] text-neutral-400 font-spartan font-bold uppercase tracking-widest leading-none">Final Total</span>
              <span className="text-xl font-spartan font-bold text-[#FFFF00] leading-none">{formatRupiah(finalTotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const detailedItems = [
                  ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
                  spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
                ].filter(Boolean).join('\n');

                const serviceSummary = [
                  ...cart
                    .filter((i: CartItem) => i.name !== 'Spot Repair')
                    .map((i: CartItem) => {
                      let nameWithSurcharges = i.name;
                      if (i.surcharges && i.surcharges.length > 0) {
                        nameWithSurcharges = `${i.name} (+${i.surcharges.join(', ')})`;
                      }
                      return `${nameWithSurcharges}||${i.price}||${i.itemNotes ? `Warna: ${i.itemNotes}` : ''}`;
                    }),
                  spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
                ].filter(Boolean).join('\n');

                // @ts-ignore
                window.__invoicePreviewData = {
                  documentType: 'invoice',
                  customerName: invoiceName,
                  customerPhone: contactPhone,
                  motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
                  items: detailedItems,
                  totalAmount: finalTotal,
                  discount: computedDiscount,
                  amountPaid: amountPaid,
                  paymentMethod: paymentMethod,
                  notes: `Layanan:\n${serviceSummary}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
                  bookingDate: entryDate,
                  realPhone,
                  downPayment: nominalDP,
                };
                setShowInvoicePreview(true);
              }}
              className="w-full py-2.5 bg-neutral-800 border border-[#FFFF00]/20 text-[#FFFF00] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-700 transition-colors"
            >
              <FileText className="size-3" />
              Preview Invoice
            </button>
            <div className="space-y-3 pt-2 border-t border-white/5">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={sendInvoiceWA}
                  onChange={e => setSendInvoiceWA(e.target.checked)}
                  className="size-5 rounded-sm border-2 border-[#FFFF00] bg-transparent text-[#FFFF00] focus:ring-0"
                />
                <span className="text-[10px] text-neutral-300 font-headline uppercase leading-none">Kirim ke WhatsApp pelanggan</span>
              </label>

              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full bg-[#1c1b1b] border border-white/10 text-[#FFFF00] text-[10px] font-bold uppercase tracking-widest px-3 py-3 rounded-sm outline-none transition-all cursor-pointer"
              >
                <option value="invoice">Invoice</option>
                <option value="tanda_terima">Receipt (Masuk)</option>
                <option value="bukti_bayar">Payment (Lunas)</option>
                <option value="garansi_repaint">Garansi Repaint</option>
                <option value="garansi_coating">Garansi Coating</option>
              </select>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 p-4 bg-neutral-950 shadow-[0px_-24px_48px_rgba(0,0,0,0.4)] flex gap-2 pb-8 z-50">
        <button onClick={onCancel} className="flex-[0.25] flex flex-col items-center justify-center text-neutral-500 py-3 active:scale-95 transition-all">
          <X className="size-5" />
          <span className="font-spartan font-bold uppercase text-[10px] mt-1">CANCEL</span>
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={isSavingDraft}
          className="flex-[0.25] flex flex-col items-center justify-center text-neutral-500 py-3 active:scale-95 transition-all disabled:opacity-50"
        >
          <FileText className="size-5" />
          <span className="font-spartan font-bold uppercase text-[10px] mt-1">{isSavingDraft ? 'SAVING...' : 'DRAFT'}</span>
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || cart.length === 0}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 bg-[#FFFF00] text-black py-4 active:scale-95 transition-all group disabled:opacity-50 disabled:grayscale",
          )}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full size-5 border-2 border-black border-t-transparent" />
          ) : (
            <Bolt className="size-5 font-bold fill-current" />
          )}
          <span className="font-spartan font-bold uppercase text-[14px] tracking-tighter">
            {isSubmitting ? 'PROCESSING...' : isEdit ? 'UPDATE MISSION' : 'BUAT BOOKING'}
          </span>
        </button>
      </footer>
      <InvoicePreviewModal
        isOpen={showInvoicePreview}
        onClose={() => setShowInvoicePreview(false)}
        invoiceData={{
          customerName: invoiceName,
          customerPhone: contactPhone,
          motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
          items: [
            ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
            spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
          ].filter(Boolean).join('\n'),
          subtotal: servicesTotal,
          discount: computedDiscount,
          totalAmount: finalTotal,
          amountPaid: amountPaid,
          paymentMethod: paymentMethod,
          notes: `Layanan:\n${cart.map((i: CartItem) => {
            const isKnown = services.some(s => s.name === i.name) || i.name === 'Spot Repair';
            const baseName = isKnown ? i.name : `${i.name} [Rp${i.price}]`;
            let result = baseName;
            if (i.surcharges.length > 0) result += ` (+${i.surcharges.join(', ')})`;
            if (i.itemNotes) result += ` (Warna: ${i.itemNotes})`;
            return result;
          }).join('\n')}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
          bookingDate: entryDate,
          downPayment: nominalDP,
          realPhone,
          documentType: docType,
        }}
        onSend={async () => {
          const token = await getIdToken();
          const detailedItems = [
            ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
            spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
          ].filter(Boolean).join('\n');
          const serviceSummary = cart.map((i: CartItem) => {
            const isKnown = services.some(s => s.name === i.name) || i.name === 'Spot Repair';
            const baseName = isKnown ? i.name : `${i.name} [Rp${i.price}]`;
            let result = baseName;
            if (i.surcharges.length > 0) result += ` (+${i.surcharges.join(', ')})`;
            if (i.itemNotes) result += ` (Warna: ${i.itemNotes})`;
            return result;
          }).join('\n');
          await fetch('/api/bookings/invoice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              documentType: docType,
              customerName: invoiceName,
              customerPhone: contactPhone,
              realPhone,
              motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
              items: detailedItems,
              subtotal: servicesTotal,
              totalAmount: finalTotal,
              discount: computedDiscount,
              amountPaid: amountPaid,
              downPayment: nominalDP,
              paymentMethod: paymentMethod,
              notes: `Layanan:\n${serviceSummary}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
              bookingDate: entryDate,
            }),
          });
        }}
      />
    </div>
  );
}

// ── DESKTOP LAYOUT ──
function DesktopLayout(props: any) {
  const {
    isEdit, currentStep, setCurrentStep,
    selectedConversation, invoiceName, setInvoiceName,
    contactPhone, setContactPhone, motorcycleModel, setMotorcycleModel,
    modelSearchText, setModelSearchText,
    platNomor, setPlatNomor, activeTab, setActiveTab, cart, addServiceToCart,
    customServiceName, setCustomServiceName, customServicePrice, setCustomServicePrice,
    addCustomService, spotCount, setSpotCount, spotPrice, setSpotPrice,
    discountPercent, setDiscountPercent, discountAmount, setDiscountAmount,
    entryDate, setEntryDate, timeSlot, setTimeSlot, homeService, setHomeService,
    dpRequired, setDpRequired, nominalDP, setNominalDP, isSubmitting, paymentMethod, setPaymentMethod,
    sendInvoiceWA, setSendInvoiceWA, showInvoicePreview, setShowInvoicePreview,
    isSavingDraft, handleSaveDraft,
    foundVehicle, setFoundVehicle, isSearching,
    handleSubmit, handleDelete, handleSelectConversation, onCancel, getIdToken,
    servicesTotal, computedDiscount, finalTotal, remainingBalance, allConversations,
    skipNextSearch, setSkipNextSearch, showAllChats, setShowAllChats,
    bookingStatus, setBookingStatus, amountPaid, setAmountPaid,
    docType, setDocType,
    services, vehicleModels, surcharges, loadingPricing,
    toggleSurchargeForItem, setItemNotesForItem, additionalNotes, setAdditionalNotes,
    realPhone, setRealPhone,
    isWalkIn, handleToggleWalkIn,
    isCustomModel, customModelSize, setCustomModelSize, effectiveMotor, setCart
  } = props;

  const isSpotRepairSelected = cart.some((item: CartItem) => item.name === 'Spot Repair');

  return (
    <div className="w-full max-w-6xl mx-auto h-full max-h-[95vh] bg-[#0E0E0E] border border-white/5 shadow-[0px_24px_48px_rgba(0,0,0,0.4)] flex flex-col md:flex-row overflow-hidden font-body">


      {/* ── SIDEBAR KIRI: PROGRESS & QUICK ACCESS ── */}
      <aside className="w-full md:w-80 bg-[#1c1b1b] p-6 border-r border-white/5 flex flex-col gap-6 overflow-y-auto no-scrollbar shrink-0">
        <div className="mb-4">
          <h2 className="font-display text-3xl font-black text-[#FFFF00] italic leading-none mb-1">
            {isEdit ? 'EDIT_MISSION' : 'NEW_MISSION'}
          </h2>
          <p className="text-[10px] font-headline text-slate-500 uppercase tracking-[0.2em]">{isEdit ? 'Mission Update Interface' : 'Booking Input Interface v2.1'}</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-[#0e0e0e] overflow-hidden p-0.5 border border-white/5 mb-6">
          <button
            onClick={() => handleToggleWalkIn(false)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-[8px] font-black uppercase tracking-widest transition-all",
              !isWalkIn ? "bg-[#FFFF00] text-black" : "text-neutral-500 hover:text-white"
            )}
          >
            <MessageSquare size={10} className={cn(!isWalkIn ? "fill-current" : "")} />
            CHAT WA
          </button>
          <button
            onClick={() => handleToggleWalkIn(true)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-[8px] font-black uppercase tracking-widest transition-all",
              isWalkIn ? "bg-[#FFFF00] text-black" : "text-neutral-500 hover:text-white"
            )}
          >
            <UserPlus size={10} className={cn(isWalkIn ? "fill-current" : "")} />
            WALK-IN
          </button>
        </div>

        {/* WhatsApp Connection Section */}
        {!isWalkIn && (
          <section className="animate-in fade-in slide-in-from-left-2 duration-300">
            <label className="block text-[10px] font-headline text-slate-500 uppercase tracking-widest mb-3">WhatsApp Connection</label>
            <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {(showAllChats ? allConversations : allConversations.slice(0, 3)).map((conv: Conversation) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 transition-colors text-left group rounded-sm border",
                  selectedConversation?.id === conv.id
                    ? "bg-[#2a2a2a] border-[#FFFF00]/30"
                    : "bg-[#0e0e0e] border-white/5 hover:bg-[#2a2a2a]"
                )}
              >
                <div className="w-8 h-8 bg-slate-800 flex items-center justify-center rounded-sm grayscale group-hover:grayscale-0">
                  <Smartphone className="size-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold font-headline uppercase text-white truncate w-40">{conv.customerName || 'No Name'}</p>
                  <p className={cn(
                    "text-[9px] font-headline tracking-tighter",
                    selectedConversation?.id === conv.id ? "text-[#FFFF00]" : "text-slate-500"
                  )}>
                    {selectedConversation?.id === conv.id ? 'ACTIVE CHAT' : `+${conv.customerPhone}`}
                  </p>
                </div>
              </button>
            ))}
            {allConversations.length > 3 && (
              <button
                onClick={() => setShowAllChats(!showAllChats)}
                className="w-full flex items-center justify-center gap-2 p-2 border border-dashed border-white/10 text-slate-500 text-[10px] font-headline uppercase hover:text-white transition-colors">
                <Search className="size-3" />
                {showAllChats ? 'Show Less' : 'Browse All Chats'}
              </button>
            )}
          </div>
        </section>
        )}

        {/* Total Summary Panel */}
        <div className="mt-auto bg-[#0e0e0e] p-4 border border-white/5">
          <h4 className="text-[10px] font-headline text-slate-500 uppercase mb-4 tracking-widest">Order Summary</h4>
          <div className="space-y-2">
            {cart.length > 0 && (
              <div className="pb-3 mb-2 border-b border-white/5 space-y-3">
                {cart.map((item: CartItem, idx: number) => {
                  const isBodiHalus = item.name.toUpperCase().includes('BODI HALUS');
                  const isVelg = item.name.toUpperCase().includes('VELG');
                  const isCvtArm = item.name.toUpperCase().includes('CVT') || item.name.toUpperCase().includes('ARM');
                  const availableSurcharges = surcharges.filter((s: any) => {
                    const isChromeOrTwoTone = s.name.toUpperCase().includes('CHROME') || s.name.toUpperCase().includes('TWO TONE');
                    if (isVelg) return isChromeOrTwoTone;
                    if (isBodiHalus) return !isChromeOrTwoTone;
                    return false;
                  });

                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-headline items-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => addServiceToCart(services.find(s => s.name === item.name) || { name: item.name } as any)}
                            className="text-red-500 hover:text-red-400 bg-red-500/10 rounded-sm p-0.5 transition-colors"
                            title="Remove service"
                          >
                            <X size={10} />
                          </button>
                          <span className="text-slate-400 truncate max-w-[150px] uppercase">
                            {item.name} {item.name === 'Spot Repair' && spotCount > 0 ? `(${spotCount}x)` : ''}
                          </span>
                        </div>
                        <span className="text-slate-300 font-mono">
                          {item.name === 'Spot Repair' ? formatRupiah(spotCount * spotPrice) : formatRupiah(item.price)}
                        </span>
                      </div>

                      {/* Independent Surcharge select in Desktop Summary */}
                      {(isBodiHalus || isVelg || isCvtArm) && availableSurcharges.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-6">
                          {availableSurcharges.map(s => (
                            <button
                              key={s.id}
                              onClick={() => toggleSurchargeForItem(item.id, s.name)}
                              className={cn(
                                "px-1.5 py-0.5 text-[8px] font-headline border rounded-sm transition-all uppercase",
                                item.surcharges.includes(s.name)
                                  ? "bg-[#FFFF00]/10 border-[#FFFF00]/50 text-[#FFFF00]"
                                  : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
                              )}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between text-xs font-headline">
              <span className="text-slate-500 uppercase">Services Total</span>
              <span className="text-white">{formatRupiah(servicesTotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-headline">
              <span className="text-slate-500 uppercase">Discount</span>
              <span className="text-red-500">- {formatRupiah(computedDiscount)}</span>
            </div>
            {dpRequired && nominalDP > 0 && (
              <div className="flex justify-between text-xs font-headline">
                <span className="text-slate-500 uppercase">Down Payment (DP)</span>
                <span className="text-[#FFFF00]">{formatRupiah(nominalDP)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-headline text-slate-600 uppercase">
                <span>Equation</span>
                <span>Total - Disc</span>
              </div>
              <div className="flex justify-between text-lg font-display font-black text-[#FFFF00] uppercase italic">
                <span>FINAL TOTAL</span>
                <span>{formatRupiah(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {isEdit && (
          <div className="mt-6 border-t border-white/5 pt-6">
            <button
              onClick={handleDelete}
              className="text-[10px] font-headline font-bold text-red-500/50 hover:text-red-500 uppercase tracking-[0.2em] transition-colors"
            >
              [ ABORT_MISSION / HAPUS BOOKING ]
            </button>
          </div>
        )}
      </aside>

      {/* ── MODAL BODY: FORMS ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#131313]">

        {/* Fixed Header with Step Indicators */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-[#1c1b1b]/30 flex-shrink-0">
          <div className="flex gap-8">
            {[
              { id: 1, label: 'Customer Info' },
              { id: 2, label: 'Technical Specs' },
              { id: 3, label: 'Finalization' }
            ].map(step => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 transition-colors cursor-pointer",
                  currentStep === step.id ? "text-[#FFFF00]" : "text-slate-500"
                )}
                onClick={() => setCurrentStep(step.id)}
              >
                <span className="text-[10px] font-headline font-bold uppercase tracking-widest">0{step.id}</span>
                <span className="text-xs font-headline font-bold uppercase">{step.label}</span>
              </div>
            ))}
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
            <X className="size-6" />
          </button>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar scroll-smooth">

          {/* Section 1: Customer & Invoice */}
          <section id="step-1" className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Customer & Invoice</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">
                  {isWalkIn ? 'Nama Customer (Manual)' : 'Invoice Name (Display)'}
                </label>
                <input
                  value={invoiceName}
                  onChange={e => setInvoiceName(e.target.value)}
                  className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline placeholder:text-slate-800 text-white focus:border-l-2 focus:border-[#FFFF00] transition-all"
                  placeholder="e.g. PT. Global Digital"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">
                  {isWalkIn ? 'Nomor HP (Manual)' : 'Contact Phone (WA ID)'}
                </label>
                <div className="relative">
                  <input
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white"
                    placeholder="628..."
                  />
                  {contactPhone.length > 8 && !isWalkIn && (
                    <Verified className="absolute right-4 top-1/2 -translate-y-1/2 text-[#cccc63] size-4 fill-[#cccc63]/20" />
                  )}
                </div>
              </div>
              <div className={cn("space-y-1 animate-in fade-in slide-in-from-top-1 duration-300", isWalkIn ? "block" : "hidden")}>
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">No. WA untuk Invoice</label>
                <input
                  value={realPhone}
                  onChange={e => setRealPhone(e.target.value)}
                  className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white placeholder:text-slate-800"
                  placeholder="08xxxxxxxxxx"
                  type="tel"
                />
              </div>
            </div>
          </section>

          <section id="step-2" className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Technical Specs</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Motorcycle Model</label>
                <div className="relative">
                  <input
                    list="motorcycle-models-desktop"
                    value={modelSearchText}
                    onChange={e => {
                      setModelSearchText(e.target.value);
                      const model = vehicleModels.find(m => m.modelName.toLowerCase() === e.target.value.toLowerCase());
                      setMotorcycleModel(model || null);
                    }}
                    onBlur={() => {
                      if (!motorcycleModel || motorcycleModel.modelName.toLowerCase() !== modelSearchText.toLowerCase()) {
                        // If no strict match and we have text, try to find partial match
                        const model = vehicleModels.find(m => m.modelName.toLowerCase().includes(modelSearchText.toLowerCase()));
                        if (model) setMotorcycleModel(model);
                      }
                    }}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white placeholder-neutral-700"
                    placeholder="Type to search model..."
                  />
                  <datalist id="motorcycle-models-desktop">
                    {vehicleModels.map(m => (
                      <option key={m.id} value={m.modelName}>{m.modelName}</option>
                    ))}
                  </datalist>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 size-5" />
                </div>
                {isCustomModel && !motorcycleModel && (
                  <div className="mt-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <button
                      type="button"
                      onClick={() => (document.activeElement as HTMLElement)?.blur()}
                      className="flex items-center gap-2 bg-[#FFFF00]/10 border border-[#FFFF00]/20 px-4 py-2 rounded-sm"
                    >
                      <PlusCircle className="size-4 text-[#FFFF00]" />
                      <span className="text-[10px] font-black uppercase text-[#FFFF00] tracking-widest">Gunakan &quot;{modelSearchText.trim().toUpperCase()}&quot; (Custom Model)</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="flex justify-between items-center text-[10px] font-headline uppercase tracking-widest">
                  <span className="text-slate-500">Plat Nomor</span>
                  <span className="text-[#FFFF00] flex items-center gap-1"><Bolt className="size-3" /> SMART SEARCH</span>
                </label>
                <input
                  value={platNomor}
                  onChange={(e) => {
                    // Matikan tameng saat user dengan sengaja mengetik manual
                    setSkipNextSearch(false);
                    setPlatNomor(e.target.value.toUpperCase());
                  }}
                  className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline placeholder:text-slate-800 text-white uppercase"
                  placeholder="B 1234 XYZ"
                />

                {/* Found Vehicle Card */}
                {foundVehicle && (
                  <div className="mt-2 p-3 bg-[#1c1b1b] border border-[#FFFF00]/20 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FFFF00]/10 flex items-center justify-center">
                        <Bolt className="size-4 text-[#FFFF00]" />
                      </div>
                      <div>
                        <p className="font-headline text-[10px] font-bold uppercase text-white leading-none mb-1">{foundVehicle.model}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-tight">Owner: {foundVehicle.owner}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // FUZZY MATCHING: Cari model yang paling mendekati
                        const model = vehicleModels.find(m =>
                          m.modelName.toLowerCase() === foundVehicle.model.toLowerCase() ||
                          foundVehicle.model.toLowerCase().includes(m.modelName.toLowerCase())
                        );
                        if (model) setMotorcycleModel(model);

                        if (!invoiceName) setInvoiceName(foundVehicle.owner);
                        if (!contactPhone) setContactPhone(foundVehicle.phone);
                        setPlatNomor(foundVehicle.plate);
                      }}
                      className="px-3 py-1 bg-[#FFFF00] text-black font-headline text-[9px] font-black uppercase rounded-sm"
                    >
                      USE_DATA
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Size Selector (Desktop) */}
            {isCustomModel && (
              <div className="bg-[#0e0e0e] p-6 border border-[#FFFF00]/20 rounded-sm flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-4">
                  <div className="px-3 py-1 bg-[#FFFF00] text-black text-[10px] font-black uppercase tracking-widest rounded-sm">
                    Custom Model Detected
                  </div>
                  <div>
                    <p className="text-xs text-white font-headline opacity-80 uppercase tracking-tight">Tentukan ukuran standar untuk estimasi harga</p>
                    <p className="text-[10px] text-slate-500">Pilih kategori yang paling mendekati dimensi motor ini</p>
                  </div>
                </div>

                <div className="flex gap-2 p-1 bg-black rounded-sm border border-white/5">
                  {(['S', 'M', 'L', 'XL'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setCustomModelSize(size)}
                      className={cn(
                        "w-12 h-10 flex items-center justify-center font-display font-black text-sm transition-all border",
                        customModelSize === size
                          ? "bg-[#FFFF00] text-black border-[#FFFF00]"
                          : "bg-transparent text-slate-500 border-transparent hover:text-white"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Service Selection (Desktop) */}
          <section id="step-3" className="space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Service Selection</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>

            <div className="flex gap-1 bg-[#0e0e0e] p-1 rounded-sm border border-white/5 w-fit">
              {(['repaint', 'detailing', 'coating'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-6 py-2 text-[10px] font-headline font-black uppercase tracking-widest transition-all",
                    activeTab === tab ? "bg-[#FFFF00] text-[#131313]" : "text-slate-500 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.filter(s => s.category === activeTab).map((service: Service) => {
                const selected = cart.some((i: CartItem) => i.name === service.name);
                const price = calculateServicePrice(service, effectiveMotor, surcharges);
                return (
                  <div
                    key={service.id}
                    onClick={() => addServiceToCart(service)}
                    className={cn(
                      "p-4 flex flex-col gap-4 transition-all border rounded-sm cursor-pointer group",
                      selected
                        ? "bg-[#FFFF00]/5 border-[#FFFF00]/30 shadow-[0_0_20px_rgba(255,255,0,0.05)]"
                        : "bg-[#1c1b1b] border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className={cn(
                        "p-2 rounded-sm transition-colors",
                        selected ? "bg-[#FFFF00] text-[#131313]" : "bg-white/5 text-slate-500 group-hover:text-white"
                      )}>
                        <Wrench size={16} />
                      </div>
                      {selected && <Check className="text-[#FFFF00] size-4" />}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-tight mb-1">{service.name}</p>
                      <p className={cn(
                        "text-lg font-display font-black italic",
                        selected ? "text-[#FFFF00]" : "text-slate-500"
                      )}>
                        {effectiveMotor ? (price > 0 ? formatRupiah(price) : 'MANUAL') : '—'}
                      </p>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Custom Service Section */}
            <div className="p-6 bg-[#1c1b1b] border border-white/5 space-y-4 rounded-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-[#FFFF00]">Add Custom Service</h4>
                <span className="text-[9px] font-headline text-slate-500 uppercase">Manual Entry Mode</span>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  value={customServiceName}
                  onChange={e => setCustomServiceName(e.target.value)}
                  className="flex-1 bg-[#0e0e0e] border-none focus:ring-0 text-xs py-3 px-4 font-headline placeholder:text-slate-800 text-white"
                  placeholder="SERVICE NAME (E.G. CHASSIS CLEANING)"
                />
                <div className="flex gap-2">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">IDR</span>
                    <input
                      type="text"
                      value={customServicePrice > 0 ? customServicePrice.toLocaleString('id-ID') : ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                        setCustomServicePrice(val ? Number(val) : 0);
                      }}
                      className="w-32 bg-[#0e0e0e] border-none focus:ring-0 text-xs py-3 pl-10 pr-4 font-headline text-white text-right"
                      placeholder="0"
                    />
                  </div>
                  <button
                    onClick={addCustomService}
                    className="bg-[#FFFF00] text-[#1D1D00] px-6 text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                  >
                    ADD_LINE
                  </button>
                </div>
              </div>
            </div>

            {/* Per-Item Surcharge Toggles (Desktop - Main Area) */}
            <div className="space-y-6">
              {cart.map((item: CartItem) => {
                const isBodiHalus = item.name.toUpperCase().includes('BODI HALUS');
                const isVelg = item.name.toUpperCase().includes('VELG');
                const isCvtArm = item.name.toUpperCase().includes('CVT') || item.name.toUpperCase().includes('ARM');

                if (!isBodiHalus && !isVelg && !isCvtArm) return null;

                const availableSurcharges = surcharges.filter((s: any) => {
                  const isChromeOrTwoTone = s.name.toUpperCase().includes('CHROME') || s.name.toUpperCase().includes('TWO TONE');
                  if (isVelg) return isChromeOrTwoTone;
                  if (isBodiHalus) return !isChromeOrTwoTone;
                  return false;
                });

                return (
                  <div key={item.id} className="p-6 bg-[#1c1b1b] border border-white/5 space-y-4 rounded-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-[#FFFF00]">
                        SETTINGS FOR: {item.name}
                      </h4>
                      <span className="text-[9px] font-headline text-slate-500 uppercase">Per-Item Selection</span>
                    </div>

                    {availableSurcharges.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4 mb-2 border-b border-white/5">
                        {availableSurcharges.map((s: any) => (
                          <label key={s.id} className={cn(
                            "flex items-center gap-3 cursor-pointer p-3 rounded-sm transition-all border",
                            item.surcharges.includes(s.name)
                              ? "bg-[#FFFF00]/10 border-[#FFFF00]/30"
                              : "bg-[#0e0e0e] border-white/5 hover:border-white/10"
                          )}>
                            <input
                              type="checkbox"
                              checked={item.surcharges.includes(s.name)}
                              onChange={() => toggleSurchargeForItem(item.id, s.name)}
                              className="rounded border-white/10 bg-[#1c1b1b] text-[#FFFF00] focus:ring-[#FFFF00] size-4"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white uppercase">{s.name}</span>
                              <span className="text-[10px] text-slate-500">{s.isPercentage ? `${s.amount}%` : formatRupiah(s.amount)}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] font-headline text-slate-500 uppercase">Catatan Warna / Detail</label>
                      <input
                        type="text"
                        value={item.itemNotes || ''}
                        onChange={(e) => setItemNotesForItem(item.id, e.target.value)}
                        placeholder="Misal: Warna merah candy tone, velg black glossy..."
                        className="w-full bg-[#0e0e0e] border border-white/5 focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-2.5 px-3 text-white placeholder-slate-700 rounded-sm"
                      />
                    </div>

                    {/* Manual Price Fallback for Custom Repaint (Desktop) */}
                    {isCustomModel && item.name === 'Repaint Bodi Halus' && item.price === 0 && (
                      <div className="space-y-1 pt-4 border-t border-white/5 mt-2">
                        <label className="text-[9px] font-headline text-[#FFFF00] uppercase">Harga Manual (Model tidak terdaftar)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-headline">IDR</span>
                          <input
                            type="text"
                            value={item.price > 0 ? item.price.toLocaleString('id-ID') : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                              const num = val ? Number(val) : 0;
                              setCart(prev => prev.map(i => i.id === item.id ? { ...i, price: num } : i));
                            }}
                            className="w-full bg-[#FFFF00]/5 border border-[#FFFF00]/20 text-sm py-3 pl-10 pr-4 text-[#FFFF00] font-mono rounded-sm"
                            placeholder="Input Harga Manual..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Spot Repair Panel - Only show if Spot Repair is selected */}
            {isSpotRepairSelected && (
              <div className="p-5 bg-[#0e0e0e] border border-dashed border-white/10 flex items-center justify-between rounded-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-4">
                  <FileText className="text-slate-500" />
                  <span className="font-headline text-[10px] font-bold uppercase text-slate-500 tracking-widest">Manual Adjust / Spot Repair</span>
                </div>
                <div className="flex gap-4">
                  <input
                    type="number"
                    value={spotCount || ''}
                    onChange={e => setSpotCount(Number(e.target.value))}
                    className="w-24 bg-[#1c1b1b] border-none focus:ring-0 text-[10px] font-headline text-center py-2 text-white"
                    placeholder="Spot Count"
                  />
                  <input
                    type="text"
                    value={spotPrice > 0 ? spotPrice.toLocaleString('id-ID') : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                      setSpotPrice(val ? Number(val) : 0);
                    }}
                    className="w-32 bg-[#1c1b1b] border-none focus:ring-0 text-[10px] font-headline text-center py-2 text-[#FFFF00]"
                    placeholder="Custom Price"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Discount Settings */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Discount Settings</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Discount Percentage (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={discountPercent || ''}
                    onChange={e => {
                      setDiscountPercent(Number(e.target.value));
                      setDiscountAmount(0);
                    }}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white text-right"
                    max="100" min="0"
                    placeholder="0"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">PERCENT</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Discount Amount (Rp)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={discountAmount > 0 ? discountAmount.toLocaleString('id-ID') : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                      setDiscountAmount(val ? Number(val) : 0);
                      setDiscountPercent(0);
                    }}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white text-right"
                    placeholder="0"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">IDR_FIXED</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Logistics & Billing */}
          <section className="space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Logistics & Billing</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Entry Date</label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={e => setEntryDate(e.target.value)}
                      className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white rounded-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Time Slot</label>
                    <input
                      type="time"
                      value={timeSlot}
                      onChange={e => setTimeSlot(e.target.value)}
                      className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white rounded-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-5 bg-[#1c1b1b] border border-[#FFFF00]/20 rounded-sm">
                  <div className="flex items-center gap-3">
                    <Wrench className="text-[#FFFF00] size-5" />
                    <span className="font-headline text-xs font-bold uppercase text-white">Home Service Mode</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={homeService}
                      onChange={e => setHomeService(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#353534] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#FFFF00] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Down Payment (DP)?</label>
                  <div className="flex gap-2">
                    {[
                      { id: true, label: 'YA' },
                      { id: false, label: 'TIDAK' }
                    ].map(opt => (
                      <button
                        key={String(opt.id)}
                        onClick={() => setDpRequired(opt.id)}
                        type="button"
                        className={cn(
                          "flex-1 py-3 text-center font-headline text-[10px] font-black uppercase border transition-all rounded-sm",
                          dpRequired === opt.id
                            ? "bg-[#FFFF00] text-[#1D1D00] border-[#FFFF00]"
                            : "bg-[#1c1b1b] text-slate-500 border-white/5"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {dpRequired && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Nominal DP</label>
                      <input
                        type="text"
                        value={nominalDP > 0 ? nominalDP.toLocaleString('id-ID') : ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                          setNominalDP(val ? Number(val) : 0);
                        }}
                        className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline font-bold text-[#FFFF00] text-right"
                        placeholder="IDR 0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Metode Pembayaran</label>
                      <div className="relative">
                        <select
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                          className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white appearance-none cursor-pointer rounded-sm"
                        >
                          <option>Tunai</option>
                          <option>Transfer BCA</option>
                          <option>QRIS</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 size-4" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Notes (Desktop) */}
                <div className="space-y-1 pt-4">
                  <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Catatan Tambahan (Warna, dll)</label>
                  <textarea
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-sm py-4 px-4 font-headline text-white placeholder-slate-700 resize-y rounded-sm"
                    placeholder="Misal: Warna merah candy tone, velg black glossy..."
                    rows={3}
                  />
                </div>

                {/* Status & Payment (Edit Mode Only) */}
                {isEdit && (
                  <div className="col-span-full mt-6 pt-6 border-t border-white/5 space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-[#FFFF00]"></span>
                      <h3 className="font-display text-xl font-bold uppercase tracking-tighter text-white italic">Status & Transaction</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Status Selection */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Active Progress Status</label>
                        <div className="flex gap-2">
                          {(['pending', 'in_progress', 'done', 'paid'] as const).map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setBookingStatus(s);
                                if (s === 'paid') setAmountPaid(finalTotal);
                              }}
                              className={cn(
                                "flex-1 py-3 text-[9px] font-black uppercase border transition-all rounded-sm",
                                bookingStatus === s
                                  ? "bg-[#FFFF00] text-[#1D1D00] border-[#FFFF00]"
                                  : "bg-[#1c1b1b] text-slate-500 border-white/5"
                              )}
                            >
                              {s.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Manual Payment Entry */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Total Amount Received (Historical)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={amountPaid > 0 ? amountPaid.toLocaleString('id-ID') : ''}
                            onChange={e => {
                              const valStr = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                              const val = valStr ? Number(valStr) : 0;
                              setAmountPaid(val);
                              if (val >= finalTotal && finalTotal > 0) setBookingStatus('paid');
                            }}
                            className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline font-bold text-[#FFFF00] text-right"
                            placeholder="IDR 0"
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">PAID_NOMINAL</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {dpRequired && nominalDP > 0 && (
                  <div className="space-y-1 pb-2">
                    <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Down Payment</label>
                    <div className="w-full bg-[#2a2a2a] py-4 px-4 font-headline text-sm text-right text-slate-300 rounded-sm">
                      -{formatRupiah(nominalDP)}
                    </div>
                  </div>
                )}

                <div className="space-y-1 pt-2 border-t border-white/5">
                  <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Remaining Balance</label>
                  <div className="w-full bg-[#2a2a2a] py-4 px-4 font-headline text-sm text-right text-slate-300 rounded-sm">
                    {formatRupiah(remainingBalance)}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Fixed Footer: Submit Actions */}
        <div className="p-6 bg-[#1c1b1b] border-t border-white/5 flex items-center justify-between min-h-[100px] flex-shrink-0 z-30">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={sendInvoiceWA}
                  onChange={e => setSendInvoiceWA(e.target.checked)}
                  className="peer h-5 w-5 bg-[#0e0e0e] border-white/10 text-[#FFFF00] focus:ring-0 rounded-sm cursor-pointer"
                />
                <Check className="absolute opacity-0 peer-checked:opacity-100 text-[#1D1D00] size-3.5 font-black pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[11px] font-headline font-bold text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                Kirim dokumen ke WhatsApp
              </span>
            </label>

            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="bg-[#0e0e0e] border border-white/10 text-[#FFFF00] text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-sm focus:ring-1 focus:ring-[#FFFF00]/50 outline-none transition-all cursor-pointer"
            >
              <option value="invoice">Invoice</option>
              <option value="tanda_terima">Receipt (Masuk)</option>
              <option value="bukti_bayar">Payment (Lunas)</option>
              <option value="garansi_repaint">Garansi Repaint</option>
              <option value="garansi_coating">Garansi Coating</option>
            </select>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="hidden md:block px-6 py-4 font-headline text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors disabled:opacity-50"
            >
              {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => {
                const detailedItems = [
                  ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
                  spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
                ].filter(Boolean).join('\n');
                const serviceSummary = cart.map((i: CartItem) => {
                  const isKnown = services.some(s => s.name === i.name) || i.name === 'Spot Repair';
                  const baseName = isKnown ? i.name : `${i.name} [Rp${i.price}]`;
                  let result = baseName;
                  if (i.surcharges.length > 0) result += ` (+${i.surcharges.join(', ')})`;
                  if (i.itemNotes) result += ` (Warna: ${i.itemNotes})`;
                  return result;
                }).join('\n');
                // @ts-ignore
                window.__invoicePreviewData = {
                  documentType: docType,
                  customerName: invoiceName,
                  customerPhone: contactPhone,
                  motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
                  items: detailedItems,
                  subtotal: servicesTotal,
                  totalAmount: finalTotal,
                  discount: computedDiscount,
                  amountPaid: amountPaid,
                  paymentMethod: paymentMethod,
                  notes: `Layanan:\n${serviceSummary}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
                  bookingDate: entryDate,
                  realPhone,
                  downPayment: nominalDP,
                };
                setShowInvoicePreview(true);
              }}
              className="hidden md:flex px-6 py-4 font-headline text-[10px] font-bold uppercase tracking-widest text-[#FFFF00] border border-[#FFFF00]/30 hover:bg-[#FFFF00]/10 transition-colors items-center gap-2"
            >
              <FileText className="size-4" />
              Preview Invoice
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || cart.length === 0}
              className={cn(
                "flex-1 md:flex-none px-12 py-4 bg-[#FFFF00] text-[#1D1D00] font-headline font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95",
                (isSubmitting || cart.length === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full size-4 border-2 border-[#1D1D00] border-t-transparent" />
              ) : (
                <Check className="size-5" />
              )}
              {isSubmitting ? 'PROCESSING...' : isEdit ? '⚡ UPDATE MISSION' : '⚡ BUAT BOOKING'}
            </button>
          </div>
        </div>
      </div>
      <InvoicePreviewModal
        isOpen={showInvoicePreview}
        onClose={() => setShowInvoicePreview(false)}
        invoiceData={{
          customerName: invoiceName,
          customerPhone: contactPhone,
          motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
          items: [
            ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
            spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
          ].filter(Boolean).join('\n'),
          subtotal: servicesTotal,
          discount: computedDiscount,
          totalAmount: finalTotal,
          amountPaid: amountPaid,
          paymentMethod: paymentMethod,
          notes: `Layanan:\n${cart.map((i: CartItem) => {
            const isKnown = services.some(s => s.name === i.name) || i.name === 'Spot Repair';
            const baseName = isKnown ? i.name : `${i.name} [Rp${i.price}]`;
            let result = baseName;
            if (i.surcharges.length > 0) result += ` (+${i.surcharges.join(', ')})`;
            if (i.itemNotes) result += ` (Warna: ${i.itemNotes})`;
            return result;
          }).join('\n')}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
          bookingDate: entryDate,
          downPayment: nominalDP,
          realPhone,
          documentType: docType,
        }}
        onSend={async () => {
          const token = await getIdToken();
          const detailedItems = [
            ...cart.map((i: CartItem) => `${i.name}||${i.price}||${i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : ''}`),
            spotCount > 0 ? `Spot Repair (${spotCount} spots)||${spotCount * spotPrice}||` : null
          ].filter(Boolean).join('\n');
          const serviceSummary = cart.map((i: CartItem) => {
            const isKnown = services.some(s => s.name === i.name) || i.name === 'Spot Repair';
            const baseName = isKnown ? i.name : `${i.name} [Rp${i.price}]`;
            let result = baseName;
            if (i.surcharges.length > 0) result += ` (+${i.surcharges.join(', ')})`;
            if (i.itemNotes) result += ` (Warna: ${i.itemNotes})`;
            return result;
          }).join('\n');
          await fetch('/api/bookings/invoice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              documentType: docType,
              customerName: invoiceName,
              customerPhone: contactPhone,
              realPhone,
              motorDetails: `${effectiveMotor?.modelName || modelSearchText.trim() || 'Motor'} (${platNomor || '-'})`,
              items: detailedItems,
              subtotal: servicesTotal,
              totalAmount: finalTotal,
              discount: computedDiscount,
              amountPaid: amountPaid,
              downPayment: nominalDP,
              paymentMethod: paymentMethod,
              notes: `Layanan:\n${serviceSummary}${additionalNotes ? `\n\nCatatan Tambahan:\n${additionalNotes}` : ''}`,
              bookingDate: entryDate,
            }),
          });
        }}
      />
    </div>
  );
}
