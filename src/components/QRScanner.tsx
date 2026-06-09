import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scannerRef.current.render(onScanSuccess, onScanFailure);

    function onScanSuccess(decodedText: string) {
      onScan(decodedText);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
      }
    }

    function onScanFailure(error: any) {
      // console.warn(`Code scan error = ${error}`);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner during cleanup", error);
        });
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Escanear Código</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-4">
          <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-0"></div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Aponte a câmera para o código de barras ou QR Code.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
