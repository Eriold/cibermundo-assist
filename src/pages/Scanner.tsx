import React, { useEffect, useMemo, useRef, useState } from 'react';
import ScannerModal from '../components/ScannerModal';
import { useNavigate } from 'react-router-dom';

import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

const Scanner: React.FC = () => {
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [result, setResult] = useState<string>('');
  const [showBanner, setShowBanner] = useState(false);
  const [formatName, setFormatName] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');

  // Efecto para ocultar el banner después de 5 segundos
  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showBanner]);

  // Anti-duplicados / anti spam (mejor con refs para NO reiniciar cámara)
  const lastCodeRef = useRef<string>('');
  const lastTsRef = useRef<number>(0);
  const COOLDOWN_MS = 1200;

  // UI demo
  const zoneScan = "Almacén Norte";
  const sessionScanOn = "SESIÓN Melissa";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // Formatos permitidos (incluye CODE_128 para guías)
  const hints = useMemo(() => {
    return new Map([
      [DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
      ]],
      // Si te cuesta leer barras, prueba activarlo:
      // [DecodeHintType.TRY_HARDER, true],
    ]);
  }, []);

  const toggleModal = () => setIsModalOpen(v => !v);
  const handleZoneSelect = () => navigate('/location');

  const handleSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Mock payload conforming to requirements: Date (DD-MM-YYYY), Name, Code, Status
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const payload = {
      fecha: formattedDate,
      usuario: "Melissa", // Simulating person name
      codigo: result,
      estado: "Pendiente"
    };

    console.log("Enviando datos a API (Mock):", payload);
    // Aquí iría la llamada real a la API
    
    alert(`Enviado: ${JSON.stringify(payload, null, 2)}`); 
  };

  useEffect(() => {
    let cancelled = false;

    const reader = new BrowserMultiFormatReader(hints);

    const start = async () => {
      try {
        setCameraError('');

        const videoEl = videoRef.current;
        if (!videoEl) return;

        // Si ya había un scanner corriendo, lo detenemos antes de iniciar otro
        if (controlsRef.current) {
          controlsRef.current.stop();
          controlsRef.current = null;
        }

        // IMPORTANTE: constraints con resolución "ideal" ayudan MUCHO a CODE_128
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        // API moderna: devuelve un control para detener el stream
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoEl,
          (decoded, err) => {
            if (cancelled) return;

            // NotFoundException es normal: solo significa "este frame no tuvo código"
            if (err && !(err instanceof NotFoundException)) {
              console.error('ZXing error:', err);
              return;
            }

            if (!decoded) return;

            const code = decoded.getText();
            const now = Date.now();

            // cooldown/dedupe (barras se detectan muchas veces)
            if (code === lastCodeRef.current && (now - lastTsRef.current) < COOLDOWN_MS) return;

            lastCodeRef.current = code;
            lastTsRef.current = now;

            // formato detectado
            const fmt = decoded.getBarcodeFormat?.();
            setFormatName(String(fmt ?? ''));

            setResult(code);
            setShowBanner(true); // Mostrar banner por 5 segundos

            // Aquí luego llamas al backend:
            // POST /packages/scan { code, zone: ... }
          }
        );

        controlsRef.current = controls;
      } catch (e: any) {
        console.error('Camera start error:', e);

        // Mensajes típicos
        if (e?.name === 'NotAllowedError') {
          setCameraError('Permiso de cámara denegado. Actívalo en tu navegador.');
        } else if (e?.name === 'NotFoundError') {
          setCameraError('No se encontró cámara en este dispositivo.');
        } else if (e?.name === 'NotReadableError') {
          setCameraError('La cámara está ocupada por otra app. Cierra otras apps que usen cámara.');
        } else {
          setCameraError('Error iniciando cámara. Revisa permisos/HTTPS.');
        }
      }
    };

    start();

    return () => {
      cancelled = true;

      // Detener decode + cámara de forma correcta
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }


    };
  }, [hints]); // <- IMPORTANTE: NO metas lastCode/lastTs aquí, porque reinicia la cámara

  return (
    <div className="bg-background-light dark:bg-background-dark font-display h-screen w-full overflow-hidden select-none relative pt-6">
      <div className="relative flex h-full w-full flex-col group/design-root">
        {/* Camera Feed Background */}
        <div className="absolute inset-0 z-0 bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover opacity-100"
            autoPlay
            muted
            playsInline
          />
          <div className="absolute inset-0 bg-black/20 z-0"></div>
        </div>

        {/* Top Status Bar & Zone Control */}
        <div className="relative z-20 flex flex-col gap-3 p-4 pt-6">
          <div className="mt-2 bg-white/95 dark:bg-[#181811]/95 backdrop-blur-xl rounded-full p-2 pl-5 pr-2 shadow-lg flex items-center justify-between border border-white/20">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-orange-500 dark:text-gray-400">Zona Actual</span>
              <h2 className="text-dark-text dark:text-white text-lg font-bold leading-none">{zoneScan}</h2>
            </div>
            <button
              className="bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-dark-text dark:text-white px-4 py-2 rounded-full text-xs font-bold transition-colors"
              onClick={handleZoneSelect}
            >
              Cambiar
            </button>
          </div>
        </div>

        {/* Center Scanning Area */}
        <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-8">
          {cameraError && (
            <div className="absolute top-4 bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              <span className="font-bold text-sm">{cameraError}</span>
            </div>
          )}

          {result && !cameraError && showBanner && (
            <div className="z-20 absolute top-4 bg-yellow-400 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
              <span className="material-symbols-outlined icon-fill">check_circle</span>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Código detectado: {result}</span>
                {formatName && <span className="text-xs opacity-90">Formato: {formatName}</span>}
              </div>
            </div>
          )}

          <div className="relative w-64 h-64 border-2 border-white/50 rounded-3xl overflow-hidden shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>

            <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_15px_rgba(249,245,6,0.8)] animate-scan"></div>

            <div className="absolute bottom-4 w-full text-center">
              <p className="text-white/80 text-xs font-medium">Alinea el código aquí</p>
              <p className="text-white/60 text-[10px] mt-1">Soporta QR y barras (CODE_128)</p>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Controls */}
        <div
          className="relative z-20 bg-white dark:bg-[#181811] rounded-t-[2rem] shadow-[0_-4px_20px_rgba(0,0,0,0.2)] pb-8 pt-6 px-6 cursor-pointer"
          onClick={toggleModal}
        >
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full"></div>

          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-green-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">{sessionScanOn}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-bold text-dark-text dark:text-white">24</h3>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">escaneados</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">3 pendientes por subir</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wide mb-1">Último</p>
              <div className="bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10">
                <p className="font-mono text-sm text-dark-text dark:text-white font-medium">{result || '240040362273'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 align-center" onClick={(e) => e.stopPropagation()}>
            <button 
              className="relative flex items-center justify-center gap-2 rounded-full h-16 px-8 bg-dark-text dark:bg-white shadow-lg group active:scale-95 transition-transform"
              onClick={handleSend}
            >
              <div className="absolute inset-0 rounded-full border-[3px] border-dark-text dark:border-white opacity-30 scale-105"></div>
              <span className="material-symbols-outlined text-3xl text-white dark:text-dark-text">send</span>
              <span className="text-xl font-bold text-white dark:text-dark-text">Enviar</span>
            </button>
          </div>
        </div>
      </div>

      { /* <ScannerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} /> */}
    </div>
  );
};

export default Scanner;
