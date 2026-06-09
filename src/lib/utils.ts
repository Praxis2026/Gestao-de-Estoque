import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date) {
  if (typeof date === 'string' && date.includes('-') && !date.includes('T')) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}
