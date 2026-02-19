
export type ItemStatus = 'sealed' | 'opened' | 'finished' | 'discarded';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  expiryDate: string;
  receptionDate: string;
  receptionTemp: number;
  lotNumber?: string;
  status: ItemStatus;
  imageUrl?: string;
  openedAt?: string;
  finishedAt?: string;
}

export interface ExtractionResult {
  name: string;
  expiryDate: string;
  lotNumber: string;
  category: string;
}

export enum AppTab {
  INVENTORY = 'inventory',
  RECEPTION = 'reception',
  HISTORY = 'history',
  SETTINGS = 'settings'
}

export interface AlertSettings {
  expiryThresholdDays: number;
  enableBrowserNotifications: boolean;
}
