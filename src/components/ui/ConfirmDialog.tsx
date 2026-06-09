import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  variant = 'danger'
}: ConfirmDialogProps) {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 shadow-red-200',
    warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
    info: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
  };

  const iconClasses = {
    danger: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-blue-600 bg-blue-50'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md">
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${iconClasses[variant]}`}>
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-slate-600 mb-8">{message}</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 text-white font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${variantClasses[variant]}`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
