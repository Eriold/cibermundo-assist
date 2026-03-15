export interface Job {
  id: number;
  type: string;
  tracking_number: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  tracking_number: string;
  office_status: string;
  checkout_by?: string;
  [key: string]: any;
}

export interface TrackingFlowRow {
  ciudad: string;
  descripcion_estado: string;
  fecha_cambio_estado: string;
  observacion: string;
  [key: string]: any;
}
