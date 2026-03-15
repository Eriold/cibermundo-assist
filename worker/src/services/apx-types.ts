export interface TrackingFlowRow {
  ciudad: string;
  descripcion_estado: string;
  fecha_cambio_estado: string;
  bodega: string;
  motivo: string;
  mensajero: string;
  numero_tipo_impreso: string;
  descripcion_tipo_impreso: string;
  usuario: string;
  observacion: string;
  has_location_icon: boolean;
}

export interface ApxData {
  recipient_name?: string;
  recipient_phone?: string;
  tracking_flow: TrackingFlowRow[];
  gestion_count: number;
}

export interface ApxResult {
  success: boolean;
  data?: ApxData;
  error?: string;
  needsHuman?: boolean;
}
