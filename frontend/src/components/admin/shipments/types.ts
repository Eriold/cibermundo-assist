export type TabMode = 'open' | 'closed';

export interface Shipment {
  tracking_number: string;
  scanned_at: string;
  scanned_by: string;
  delivery_type: string;
  office_status: string;
  api_success?: number;
  api_message?: string | null;
  zone_name?: string;
  zone_id?: number | null;
  api_current_state_desc?: string;
  payment_desc?: string;
  amount_total?: number;
  status_id?: number | null;
  status_name?: string;
  management_id?: number | null;
  management_name?: string;
  client_name?: string;
  client_phone?: string;
  recipient_name?: string;
  recipient_phone?: string;
  obs_1?: string;
  obs_2?: string;
  obs_3?: string;
  checkout_date?: string;
  checkout_by?: string;
  checkout_by_name?: string;
  message_sent?: number;
  gestion_count?: number;
  record_source?: 'active' | 'archive';
}

export interface CatalogItem {
  id: number;
  name: string;
}

export interface ShipmentFilters {
  zoneId: string;
  managementId: string;
  dateFrom: string;
  dateTo: string;
  checkoutDateFrom: string;
  checkoutDateTo: string;
}

export interface GestionSummary {
  [key: string]: number;
}

export interface TrackingRow {
  ciudad?: string;
  descripcion_estado?: string;
  fecha_cambio_estado?: string;
  bodega?: string;
  motivo?: string;
  mensajero?: string;
  observacion?: string;
  has_location_icon?: boolean;
}
