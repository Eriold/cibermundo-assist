import Dexie, { type Table } from 'dexie';

export interface OfflineScan {
  id?: number;
  tracking_number: string;
  scanned_by: string;
  delivery_type: string;
  created_at: string;
  status: 'PENDING' | 'SYNCED' | 'ERROR';
  sync_attempts: number;
  error_message?: string;
}

export class CibermundoDB extends Dexie {
  scans!: Table<OfflineScan, number>;

  constructor() {
    super('CibermundoAssistDB');
    
    this.version(1).stores({
      scans: '++id, tracking_number, status, created_at'
    });
  }
}

export const db = new CibermundoDB();
