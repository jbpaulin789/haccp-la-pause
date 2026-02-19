
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, PlusCircle, History, Camera, Package, Trash2, 
  Loader2, Calendar, Settings, BellRing, Clock, RotateCcw, Undo2,
  Smartphone, MoreVertical, Share, Info
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

  useEffect(() => {
    const savedItems = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedItems) setItems(JSON.parse(savedItems));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings]);

  const urgentItems = useMemo(() => {
    const now = new Date();
    return items.filter(item => {
      if (item.status === 'finished' || item.status === 'discarded') return false;
      const expiry = new Date(item.expiryDate);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= settings.expiryThresholdDays;
    });
  }, [items, settings.expiryThresholdDays]);

  const addItem = (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
    setActiveTab(AppTab.INVENTORY);
  };

  const updateItemStatus = (id: string, newStatus: ItemStatus) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updates: any = { status: newStatus };
        if (newStatus === 'opened') updates.openedAt = new Date().toISOString();
        if (newStatus === 'finished' || newStatus === 'discarded') updates.finishedAt = new Date().toISOString();
        return { ...item, ...updates };
      }
      return item;
    }));
  };

  const filteredItems = items.filter(item => 
    item.status !== 'finished' && item.status !== 'discarded' &&
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-gray-50 overflow-hidden shadow-xl">
      <header className="bg-blue-700 text-white p-4 pt-10 shadow-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6" />
          <h1 className="text-xl font-bold italic">HACCP La Pause</h1>
        </div>
        <div className="flex items-center gap-3">
          {urgentItems.length > 0 && <BellRing className="w-5 h-5 text-yellow-300 animate-bounce" />}
          {isProcessing && <Loader2 className="w-5 h-5 animate-spin" />}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 touch-pan-y">
        {activeTab === AppTab.INVENTORY && <InventoryView items={filteredItems} onUpdateStatus={updateItemStatus} searchTerm={searchTerm} setSearchTerm={setSearchTerm} threshold={settings.expiryThresholdDays} />}
        {activeTab === AppTab.RECEPTION && <ReceptionView onAdd={addItem} onStartProcessing={() => setIsProcessing(true)} onEndProcessing={() => setIsProcessing(false)} />}
        {activeTab === AppTab.HISTORY && <HistoryView items={items.filter(i => i.status === 'finished' || i.status === 'discarded')} />}
        {activeTab === AppTab.SETTINGS && <SettingsView settings={settings} setSettings={setSettings} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-3 pb-6 flex justify-around items-center z-50">
        <NavButton active={activeTab === AppTab.INVENTORY} icon={<Package />} label="Stock" onClick={() => setActiveTab(AppTab.INVENTORY)} />
        <NavButton active={activeTab === AppTab.RECEPTION} icon={<PlusCircle />} label="Ajouter" onClick={() => setActiveTab(AppTab.RECEPTION)} />
        <NavButton active={activeTab === AppTab.HISTORY} icon={<History />} label="Journal" onClick={() => setActiveTab(AppTab.HISTORY)} />
        <NavButton active={activeTab === AppTab.SETTINGS} icon={<Settings />} label="Réglages" onClick={() => setActiveTab(AppTab.SETTINGS)} />
      </nav>
    </div>
  );
};

const NavButton = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
    {React.cloneElement(icon, { size: 22 })}
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

const InventoryView = ({ items, onUpdateStatus, searchTerm, setSearchTerm, threshold }: any) => (
  <div className="p-4 space-y-4">
    <input type="text" placeholder="Rechercher..." className="w-full p-3 rounded-xl border" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
    {items.length === 0 ? <p className="text-center py-10 text-gray-400">Aucun produit</p> : items.map((item: any) => (
      <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between mb-3">
          <h3 className="font-bold">{item.name}</h3>
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase">{item.status}</span>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <div className="text-gray-500">DLC: <span className="font-bold text-gray-900">{new Date(item.expiryDate).toLocaleDateString()}</span></div>
          <div className="text-gray-500">Lot: <span className="font-bold text-gray-900">{item.lotNumber || 'N/A'}</span></div>
        </div>
        <div className="flex gap-2">
          {item.status === 'sealed' ? (
            <button onClick={() => onUpdateStatus(item.id, 'opened')} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">OUVRIR</button>
          ) : (
            <button onClick={() => onUpdateStatus(item.id, 'finished')} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold">FINI</button>
          )}
          <button onClick={() => onUpdateStatus(item.id, 'discarded')} className="bg-red-50 text-red-600 px-3 rounded-lg"><Trash2 size={18}/></button>
        </div>
      </div>
    ))}
  </div>
);

const ReceptionView = ({ onAdd, onStartProcessing, onEndProcessing }: any) => {
  const [formData, setFormData] = useState({ name: '', expiryDate: '', lotNumber: '', receptionTemp: 4 });
  const [image, setImage] = useState<string | null>(null);

  const handleCapture = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    onStartProcessing();
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImage(base64);
      const res = await extractProductInfo(base64.split(',')[1]);
      if (res) setFormData({ ...formData, name: res.name || '', expiryDate: res.expiryDate || '', lotNumber: res.lotNumber || '' });
      onEndProcessing();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm border">
        <h2 className="font-bold uppercase italic mb-4">Réception Marchandise</h2>
        <div className="mb-4 aspect-video bg-gray-50 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden">
          {image ? <img src={image} className="w-full h-full object-cover" /> : <><Camera size={32} className="text-gray-300 mb-2"/><p className="text-xs text-gray-400">Scanner étiquette</p></>}
          <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0" onChange={handleCapture} />
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="Nom du produit" className="w-full p-3 border rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <input type="date" className="w-full p-3 border rounded-xl" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
          <input type="text" placeholder="N° de Lot" className="w-full p-3 border rounded-xl" value={formData.lotNumber} onChange={e => setFormData({...formData, lotNumber: e.target.value})} />
          <button onClick={() => onAdd({...formData, id: Date.now().toString(), status: 'sealed', receptionDate: new Date().toISOString()})} className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold uppercase">Enregistrer</button>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ items }: any) => (
  <div className="p-4 space-y-3">
    <h2 className="font-bold uppercase italic">Dernières sorties</h2>
    {items.map((i: any) => (
      <div key={i.id} className="bg-white p-3 rounded-xl border text-sm flex justify-between">
        <div><div className="font-bold">{i.name}</div><div className="text-[10px] text-gray-400 uppercase">Lot: {i.lotNumber}</div></div>
        <div className="text-right"><div className={i.status === 'finished' ? 'text-blue-600' : 'text-red-600'}>{i.status === 'finished' ? 'Consommé' : 'Perte'}</div><div className="text-[10px] text-gray-400">{new Date(i.finishedAt).toLocaleDateString()}</div></div>
      </div>
    ))}
  </div>
);

const SettingsView = ({ settings, setSettings }: any) => (
  <div className="p-6 space-y-6">
    <h2 className="text-xl font-bold uppercase italic">Réglages</h2>
    <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 space-y-4">
      <div className="flex items-center gap-2 text-blue-700 font-bold uppercase text-[10px]"><Info size={14}/> Installation Facile</div>
      <div className="text-xs space-y-3 text-gray-600">
        <div className="flex gap-2"><div className="font-bold text-blue-600">Android:</div>Menu <MoreVertical size={12} className="inline"/> > "Installer l'application"</div>
        <div className="flex gap-2"><div className="font-bold text-pink-600">iPhone:</div>Partager <Share size={12} className="inline"/> > "Sur l'écran d'accueil"</div>
      </div>
    </div>
    <div className="bg-white p-5 rounded-2xl border flex justify-between items-center">
      <span className="font-bold text-gray-700">Alerte DLC (jours)</span>
      <input type="number" className="w-12 text-center font-bold text-blue-600" value={settings.expiryThresholdDays} onChange={e => setSettings({...settings, expiryThresholdDays: e.target.value})} />
    </div>
  </div>
);

export default App;