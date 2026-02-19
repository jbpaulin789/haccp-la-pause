
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ClipboardList, 
  PlusCircle, 
  History, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Trash2, 
  ChevronRight,
  Loader2,
  Calendar,
  Thermometer,
  FileText,
  Settings,
  Bell,
  BellRing,
  Clock,
  RotateCcw,
  Undo2,
  CalendarDays
} from 'lucide-react';
import { AppTab, InventoryItem, ItemStatus, AlertSettings } from './types';
import { extractProductInfo } from './services/geminiService';

const STORAGE_KEY = 'haccp_stock_data';
const SETTINGS_KEY = 'haccp_stock_settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.INVENTORY);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState<AlertSettings>({
    expiryThresholdDays: 3,
    enableBrowserNotifications: false
  });

  // Load data & settings
  useEffect(() => {
    const savedItems = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedItems) setItems(JSON.parse(savedItems));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    
    // Request notification permission if enabled in state
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.enableBrowserNotifications && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Save changes
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings]);

  const urgentItems = useMemo(() => {
    const now = new Date();
    return items.filter(item => {
      if (item.status === 'finished' || item.status === 'discarded') return false;
      const expiry = new Date(item.expiryDate);
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= settings.expiryThresholdDays;
    });
  }, [items, settings.expiryThresholdDays]);

  // Check for notifications
  useEffect(() => {
    if (settings.enableBrowserNotifications && Notification.permission === 'granted' && urgentItems.length > 0) {
      const urgentCount = urgentItems.filter(i => isExpired(i.expiryDate)).length;
      if (urgentCount > 0) {
        new Notification("Alerte HACCP", {
          body: `${urgentCount} article(s) sont périmés ou arrivent à expiration !`,
        });
      }
    }
  }, [urgentItems.length, settings.enableBrowserNotifications]);

  const addItem = (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
    setActiveTab(AppTab.INVENTORY);
  };

  const updateItemStatus = (id: string, newStatus: ItemStatus) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updates: Partial<InventoryItem> = { status: newStatus };
        if (newStatus === 'opened') {
          updates.openedAt = new Date().toISOString();
        } else if (newStatus === 'sealed') {
          updates.openedAt = undefined;
        } else if (newStatus === 'finished' || newStatus === 'discarded') {
          updates.finishedAt = new Date().toISOString();
        }
        return { ...item, ...updates };
      }
      return item;
    }));
  };

  const restoreItem = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        // If it was opened before, revert to opened, otherwise sealed
        const wasOpened = !!item.openedAt;
        return { 
          ...item, 
          status: wasOpened ? 'opened' : 'sealed', 
          finishedAt: undefined 
        };
      }
      return item;
    }));
    setActiveTab(AppTab.INVENTORY);
  };

  const deleteItem = (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer cet article définitivement ?")) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const filteredItems = items.filter(item => 
    item.status !== 'finished' && 
    item.status !== 'discarded' &&
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const historyItems = items.filter(item => 
    item.status === 'finished' || item.status === 'discarded'
  ).sort((a, b) => new Date(b.finishedAt || b.receptionDate).getTime() - new Date(a.finishedAt || a.receptionDate).getTime());

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 overflow-hidden shadow-xl border-x">
      <header className="bg-blue-700 text-white p-4 shadow-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6" />
          <h1 className="text-xl font-bold italic tracking-tight">HACCP La Pause</h1>
        </div>
        <div className="flex items-center gap-3">
          {urgentItems.length > 0 && (
            <div className="relative animate-bounce">
              <BellRing className="w-5 h-5 text-yellow-300" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                {urgentItems.length}
              </span>
            </div>
          )}
          {isProcessing && <Loader2 className="w-5 h-5 animate-spin" />}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === AppTab.INVENTORY && (
          <InventoryView 
            items={filteredItems} 
            onUpdateStatus={updateItemStatus} 
            onDelete={deleteItem}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            threshold={settings.expiryThresholdDays}
          />
        )}
        {activeTab === AppTab.RECEPTION && (
          <ReceptionView 
            onAdd={addItem} 
            onStartProcessing={() => setIsProcessing(true)} 
            onEndProcessing={() => setIsProcessing(false)} 
          />
        )}
        {activeTab === AppTab.HISTORY && (
          <HistoryView items={historyItems} onRestore={restoreItem} onDelete={deleteItem} />
        )}
        {activeTab === AppTab.SETTINGS && (
          <SettingsView settings={settings} setSettings={setSettings} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <NavButton active={activeTab === AppTab.INVENTORY} icon={<Package />} label="Stock" onClick={() => setActiveTab(AppTab.INVENTORY)} />
        <NavButton active={activeTab === AppTab.RECEPTION} icon={<PlusCircle />} label="Ajouter" onClick={() => setActiveTab(AppTab.RECEPTION)} />
        <NavButton active={activeTab === AppTab.HISTORY} icon={<History />} label="Journal" onClick={() => setActiveTab(AppTab.HISTORY)} />
        <NavButton active={activeTab === AppTab.SETTINGS} icon={<Settings />} label="Réglages" onClick={() => setActiveTab(AppTab.SETTINGS)} />
      </nav>
    </div>
  );
};

// --- Sub-components ---

const NavButton: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 flex-1 transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}>
    <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform`}>
      {/* Fix: cast icon to React.ReactElement<any> to avoid "size" property not existing on unknown type during cloneElement */}
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 22 }) : icon}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

const InventoryView: React.FC<{ 
  items: InventoryItem[]; 
  onUpdateStatus: (id: string, status: ItemStatus) => void; 
  onDelete: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  threshold: number;
}> = ({ items, onUpdateStatus, onDelete, searchTerm, setSearchTerm, threshold }) => {
  return (
    <div className="p-4 space-y-4">
      <div className="relative">
        <input 
          type="text"
          placeholder="Produit, lot, catégorie..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Package className="absolute left-3 top-3.5 text-gray-400" size={18} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
          <Package size={64} className="mb-4 opacity-10" />
          <p className="font-medium">Stock vide</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const expired = isExpired(item.expiryDate);
            const urgent = isUrgent(item.expiryDate, threshold);
            
            return (
              <div key={item.id} className={`bg-white rounded-2xl shadow-sm border transition-all ${
                expired ? 'border-red-500 ring-1 ring-red-500' : urgent ? 'border-orange-400 ring-1 ring-orange-400' : 'border-gray-100'
              }`}>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover bg-gray-50 border border-gray-100" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100">
                          <Package size={24} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-gray-900 leading-tight">{item.name}</h3>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{item.category} • Lot: {item.lotNumber || 'N/A'}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                      item.status === 'sealed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.status === 'sealed' ? 'Scellé' : 'Ouvert'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`flex flex-col p-2 rounded-xl border ${expired ? 'bg-red-50 border-red-100' : urgent ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                      <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Calendar size={10} /> DLC
                      </span>
                      <span className={`text-sm font-black ${expired ? 'text-red-600' : urgent ? 'text-orange-600' : 'text-gray-800'}`}>
                        {new Date(item.expiryDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Clock size={10} /> Entrée Stock
                      </span>
                      <span className="text-sm font-black text-gray-800">
                        {new Date(item.receptionDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {/* Display Opening Date if the item is opened */}
                    {item.openedAt && (
                      <div className="col-span-2 flex flex-col p-2 rounded-xl bg-blue-50 border border-blue-100">
                        <span className="text-[9px] font-bold text-blue-600 uppercase flex items-center gap-1">
                          <CalendarDays size={10} /> Date d'ouverture
                        </span>
                        <span className="text-sm font-black text-blue-900">
                          {new Date(item.openedAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {item.status === 'sealed' ? (
                      <button onClick={() => onUpdateStatus(item.id, 'opened')} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 active:bg-blue-700">
                        OUVRIR
                      </button>
                    ) : (
                      <div className="flex flex-1 gap-2">
                        <button onClick={() => onUpdateStatus(item.id, 'finished')} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 active:bg-green-700">
                          TERMINÉ
                        </button>
                        <button onClick={() => onUpdateStatus(item.id, 'sealed')} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 active:bg-gray-200">
                          <Undo2 size={16} /> RE-SCELLER
                        </button>
                      </div>
                    )}
                    <button onClick={() => onUpdateStatus(item.id, 'discarded')} className="px-3 bg-red-100 text-red-700 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 active:bg-red-200">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ReceptionView: React.FC<{ 
  onAdd: (item: InventoryItem) => void;
  onStartProcessing: () => void;
  onEndProcessing: () => void;
}> = ({ onAdd, onStartProcessing, onEndProcessing }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    category: 'Autres',
    expiryDate: new Date().toISOString().split('T')[0],
    receptionDate: new Date().toISOString().split('T')[0],
    receptionTemp: 4,
    lotNumber: '',
  });
  const [tempImage, setTempImage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onStartProcessing();
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const base64Clean = base64.split(',')[1];
      setTempImage(base64);
      const result = await extractProductInfo(base64Clean);
      if (result) {
        setFormData(prev => ({
          ...prev,
          name: result.name || prev.name,
          category: result.category || prev.category,
          lotNumber: result.lotNumber || prev.lotNumber,
          expiryDate: result.expiryDate || prev.expiryDate,
        }));
      }
      onEndProcessing();
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.expiryDate) return alert("Nom et DLC obligatoires.");
    onAdd({
      id: crypto.randomUUID(),
      name: formData.name!,
      category: formData.category!,
      expiryDate: formData.expiryDate!,
      receptionDate: formData.receptionDate || new Date().toISOString(),
      receptionTemp: formData.receptionTemp || 4,
      lotNumber: formData.lotNumber,
      status: 'sealed',
      imageUrl: tempImage || undefined,
    });
  };

  return (
    <div className="p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black mb-6 text-gray-900 uppercase italic">Réception Marchandise</h2>
        <div className="mb-6">
          <div className="relative w-full aspect-video bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-colors hover:border-blue-400">
            {tempImage ? (
              <img src={tempImage} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-gray-400">
                <Camera size={40} className="mx-auto mb-2 opacity-50 text-blue-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest px-8 leading-relaxed">Scanner étiquette (IA)</p>
              </div>
            )}
            <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nom du Produit</label>
            <input type="text" required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Date Entrée Stock</label>
              <input type="date" required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold" value={formData.receptionDate} onChange={e => setFormData({...formData, receptionDate: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase ml-1 text-red-500">DLC / Date Limite</label>
              <input type="date" required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-100 outline-none font-bold" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Temp. (°C)</label>
              <input type="number" step="0.1" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold" value={formData.receptionTemp} onChange={e => setFormData({...formData, receptionTemp: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Lot</label>
              <input type="text" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="LXXXX" value={formData.lotNumber} onChange={e => setFormData({...formData, lotNumber: e.target.value})} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Catégorie</label>
            <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold appearance-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              <option>Viandes</option><option>Poissons</option><option>Laitages</option><option>Végétaux</option><option>Sec</option><option>Autres</option>
            </select>
          </div>

          <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 transition-all active:scale-[0.97] uppercase italic tracking-widest">
            Valider Entrée
          </button>
        </form>
      </div>
    </div>
  );
};

const SettingsView: React.FC<{ 
  settings: AlertSettings; 
  setSettings: (s: AlertSettings) => void; 
}> = ({ settings, setSettings }) => {
  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-black text-gray-900 uppercase italic">Paramètres Alertes</h2>
      
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                <Bell size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800 leading-tight">Seuil d'alerte DLC</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Prévenir avant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                className="w-16 p-2 bg-gray-50 border rounded-xl text-center font-black text-blue-600"
                value={settings.expiryThresholdDays}
                onChange={e => setSettings({...settings, expiryThresholdDays: parseInt(e.target.value) || 0})}
              />
              <span className="text-xs font-bold text-gray-500">Jours</span>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <BellRing size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800 leading-tight">Notifications Push</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Alertes système</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const newState = !settings.enableBrowserNotifications;
                if (newState && Notification.permission !== 'granted') {
                  Notification.requestPermission();
                }
                setSettings({...settings, enableBrowserNotifications: newState});
              }}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableBrowserNotifications ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.enableBrowserNotifications ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryView: React.FC<{ 
  items: InventoryItem[]; 
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ items, onRestore, onDelete }) => (
  <div className="p-4 space-y-4">
    <h2 className="text-xl font-black mb-4 text-gray-900 uppercase italic">Journal HACCP</h2>
    {items.length === 0 ? (
      <div className="text-center py-20 text-gray-400">
        <FileText size={64} className="mx-auto mb-4 opacity-10" />
        <p className="font-medium">Aucun enregistrement</p>
      </div>
    ) : (
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-gray-900 leading-tight">{item.name}</h3>
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">{item.category} • Lot: {item.lotNumber}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  item.status === 'finished' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                }`}>
                  {item.status === 'finished' ? 'Consommé' : 'Perte'}
                </div>
                <button 
                  onClick={() => onRestore(item.id)}
                  className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tighter"
                >
                  <RotateCcw size={10} /> Restaurer
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-50 font-medium">
              <span>Arrivé le:</span><span className="text-right font-bold">{new Date(item.receptionDate).toLocaleDateString()}</span>
              <span>DLC:</span><span className="text-right font-bold">{new Date(item.expiryDate).toLocaleDateString()}</span>
              {item.openedAt && (<><span>Ouvert le:</span><span className="text-right font-bold">{new Date(item.openedAt).toLocaleDateString()}</span></>)}
              <span>{item.status === 'finished' ? 'Sorti le:' : 'Jeté le:'}</span><span className="text-right font-bold">{new Date(item.finishedAt!).toLocaleDateString()}</span>
            </div>
            <button 
              onClick={() => onDelete(item.id)}
              className="mt-3 w-full text-center text-xs text-red-400 font-bold hover:text-red-600 py-1"
            >
              Supprimer définitivement
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

// --- Helpers ---

const isExpired = (dateStr: string) => {
  const expiry = new Date(dateStr);
  const now = new Date();
  now.setHours(0,0,0,0);
  expiry.setHours(0,0,0,0);
  return expiry.getTime() < now.getTime();
};

const isUrgent = (dateStr: string, threshold: number) => {
  const expiry = new Date(dateStr);
  const now = new Date();
  now.setHours(0,0,0,0);
  expiry.setHours(0,0,0,0);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
  return diffDays <= threshold && diffDays >= 0;
};

export default App;