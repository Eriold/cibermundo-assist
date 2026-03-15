export interface PaymentWebResponse {
  Success: boolean;
  Message?: string;
  Guia?: {
    FormasPago?: Array<{
      IdFormaPago: number;
      Descripcion: string;
    }>;
    ValorTotal: number;
    ValorDeclarado: number;
  };
  TrazaGuia?: {
    DescripcionEstadoGuia?: string;
    Ciudad?: string;
    FechaGrabacion?: string;
  };
}
