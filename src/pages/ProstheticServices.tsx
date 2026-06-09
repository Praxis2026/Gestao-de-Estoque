import React, { useEffect, useState } from 'react';
import { supabase, priceTablesSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Truck,
  Calendar,
  User,
  History,
  MoreVertical,
  QrCode,
  ArrowRight,
  TrendingUp,
  Loader2,
  X,
  Activity,
  FileText,
  Trash2,
  Tag
} from 'lucide-react';
import { 
  ProstheticService, 
  Patient, 
  Supplier, 
  ProstheticStatus, 
  OnusRepeticao 
} from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

const STATUS_CONFIG = {
  ABERTO: { label: 'Solicitado ao Laboratório', color: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-50', icon: Clock },
  REPETICAO: { label: 'Recall / Repetição', color: 'bg-red-500', text: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle },
  AJUSTE_REQUISITADO: { label: 'Solicitado Ajuste', color: 'bg-orange-500', text: 'text-orange-500', bg: 'bg-orange-50', icon: RotateCcw },
  RECEBIDO: { label: 'Recebido na Clínica', color: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-50', icon: User },
  FINALIZADO: { label: 'Finalizado / Entregue', color: 'bg-green-500', text: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 },
};

export default function ProstheticServices() {
  const { user } = useAuth();
  const [services, setServices] = useState<ProstheticService[]>([]);
  const [laboratories, setLaboratories] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProstheticStatus | 'ALL'>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'OVERDUE' | 'NEAR_DEADLINE'>('ALL');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Patient Search states
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [externalPriceItems, setExternalPriceItems] = useState<any[]>([]);
  const [isSearchingPrices, setIsSearchingPrices] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [priceSearchTerm, setPriceSearchTerm] = useState('');

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (patientSearch && showPatientResults) {
        searchPatientsRemote(patientSearch);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [patientSearch]);

  const fetchExternalPrices = async (supplierId: string) => {
    if (!priceTablesSupabase) {
      console.warn('Conexão com banco de preços externo não configurada (VITE_PRICE_TABLES__URL/KEY)');
      return;
    }
    
    const localSupplier = laboratories.find(l => l.id.toString() === supplierId);
    if (!localSupplier?.cnpj) {
      console.warn('Fornecedor local não possui CNPJ cadastrado');
      setExternalPriceItems([]);
      return;
    }

    const cleanDocument = localSupplier.cnpj.replace(/\D/g, '');
    console.log('Buscando preços externos para CNPJ:', cleanDocument);

    setIsSearchingPrices(true);
    try {
      console.log('--- INÍCIO DIAGNÓSTICO EXTERNO ---');
      console.log('Documento Alvo (Limpo):', cleanDocument);
      console.log('Nome do Laboratório Local:', localSupplier.nome);
      
      // 1. Encontrar o fornecedor externo
      let extSup = null;
      
      // Tentativa 1: Match exato de documento
      const attempt1 = await priceTablesSupabase
        .from('suppliers')
        .select('id, document_id, name')
        .eq('document_id', cleanDocument)
        .maybeSingle();
      
      extSup = attempt1.data;

      // Tentativa 2: Busca por nome do laboratório (caso o documento esteja diferente)
      if (!extSup) {
        console.log('Não encontrado por documento. Tentando busca por nome...');
        const attemptName = await priceTablesSupabase
          .from('suppliers')
          .select('id, document_id, name')
          .ilike('name', `%${localSupplier.nome}%`)
          .limit(1);
        
        if (attemptName.data && attemptName.data.length > 0) {
          extSup = attemptName.data[0];
          console.log('Fornecedor encontrado via busca por nome:', extSup.name);
        }
      }

      // Tentativa 3: Documento como número
      if (!extSup && !isNaN(Number(cleanDocument))) {
        const attemptNum = await priceTablesSupabase
          .from('suppliers')
          .select('id, document_id, name')
          .eq('document_id', Number(cleanDocument))
          .maybeSingle();
        extSup = attemptNum.data;
      }
      
      if (!extSup) {
        // Teste final: Listar qualquer coisa da tabela para ver se o RLS está bloqueando
        const { data: anyData, error: anyError } = await priceTablesSupabase.from('suppliers').select('id').limit(1);
        if (anyError) {
          console.error('ERRO DE PERMISSÃO/RLS NA TABELA SUPPLIERS:', anyError);
        } else if (!anyData || anyData.length === 0) {
          console.error('A TABELA SUPPLIERS PARECE VAZIA PARA O USUÁRIO ANON. Verifique as Policies de RLS no Supabase Externo.');
        }

        setExternalPriceItems([]);
        return;
      }

      console.log('Fornecedor externo identificado com sucesso:', extSup);

      // 2. Buscar Tabelas de Preço
      // Tentativa com supplier_id ou suplier_id
      let tablesResult = await priceTablesSupabase
        .from('price_tables')
        .select('id, name')
        .eq('supplier_id', extSup.id);
      
      if (tablesResult.error || !tablesResult.data || tablesResult.data.length === 0) {
        tablesResult = await priceTablesSupabase
          .from('price_tables')
          .select('id, name')
          .eq('suplier_id', extSup.id);
      }

      const tables = tablesResult.data;
      if (!tables || tables.length === 0) {
        console.warn('Este fornecedor existe, mas não tem tabelas de preço vinculadas a ele no campo supplier_id/suplier_id:', extSup.id);
        setExternalPriceItems([]);
        return;
      }

      console.log(`${tables.length} tabelas encontradas. Buscando serviços na tabela 'services'...`);
      
      // 3. Buscar Itens na tabela 'services'
      const tableIds = tables.map(t => t.id);
      const { data: items, error: itemsErr } = await priceTablesSupabase
        .from('services')
        .select('id, name, price, table_id')
        .in('table_id', tableIds)
        .order('name');
 
       if (itemsErr) {
         console.error('Erro ao buscar itens na tabela services:', itemsErr);
         setExternalPriceItems([]);
         return;
       }
 
       console.log(`${items?.length || 0} serviços carregados com sucesso.`);
       setExternalPriceItems(items || []);
    } catch (error) {
      console.error('Falha crítica na busca externa:', error);
      setExternalPriceItems([]);
    } finally {
      setIsSearchingPrices(false);
      console.log('--- FIM DIAGNÓSTICO EXTERNO ---');
    }
  };

  const searchPatientsRemote = async (term: string) => {
    if (term.length < 2) return;
    setSearchingPatients(true);
    try {
      const { data, error } = await supabase
        .from('Patient')
        .select('*')
        .ilike('nome', `%${term}%`)
        .order('nome')
        .limit(20);

      if (error) throw error;
      setPatientSearchResults(data || []);
    } catch (error) {
      console.error('Erro ao pesquisar pacientes:', error);
    } finally {
      setSearchingPatients(false);
    }
  };
  
  // Form states
  const [selectedService, setSelectedService] = useState<ProstheticService | null>(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    supplier_id: '',
    descricao_trabalho: '',
    valor_servico: 0,
    data_previsao: '',
    observacoes: '',
    status: 'ABERTO' as ProstheticStatus,
    is_repeticao: false,
    onus_repeticao: '' as OnusRepeticao | '',
    items: [] as { id?: number; descricao: string; valor: number }[],
  });

  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [servicesRes, labsRes] = await Promise.all([
        supabase.from('prosthetic_services')
          .select('*, patient:patient_id(nome), supplier:supplier_id(nome), items:prosthetic_service_items(*)')
          .order('created_at', { ascending: false }),
        supabase.from('Supplier').select('*').order('nome')
      ]);

      if (servicesRes.data) setServices(servicesRes.data);
      if (labsRes.data) setLaboratories(labsRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!selectedService) return;
    setIsDeleting(true);
    try {
      // Delete logs first (if not cascading)
      const { error: logsError } = await supabase
        .from('prosthetic_service_logs')
        .delete()
        .eq('service_id', selectedService.id);
      
      if (logsError) throw logsError;

      // Delete the service
      const { error: serviceError } = await supabase
        .from('prosthetic_services')
        .delete()
        .eq('id', selectedService.id);

      if (serviceError) throw serviceError;

      await fetchInitialData();
      setIsConfirmOpen(false);
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Erro ao excluir OS: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenModal = (service?: ProstheticService) => {
    if (service) {
      setSelectedService(service);
      const patientName = (service.patient as any)?.nome || '';
      setPatientSearch(patientName);
      setFormData({
        patient_id: service.patient_id.toString(),
        supplier_id: service.supplier_id.toString(),
        descricao_trabalho: service.descricao_trabalho,
        valor_servico: service.valor_servico,
        data_previsao: service.data_previsao || '',
        observacoes: service.observacoes || '',
        status: service.status,
        is_repeticao: service.is_repeticao,
        onus_repeticao: service.onus_repeticao || '',
        items: service.items || [],
      });
      if (service.supplier_id) {
        fetchExternalPrices(service.supplier_id.toString());
      }
    } else {
      setSelectedService(null);
      setPatientSearch('');
      setExternalPriceItems([]);
      setFormData({
        patient_id: '',
        supplier_id: '',
        descricao_trabalho: '',
        valor_servico: 0,
        data_previsao: '',
        observacoes: '',
        status: 'ABERTO',
        is_repeticao: false,
        onus_repeticao: '',
        items: [{ descricao: '', valor: 0 }],
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const hasValidItems = formData.items.length > 0 && formData.items.some(item => item.descricao.trim() !== '');
    
    if (!formData.patient_id || !formData.supplier_id || !formData.data_previsao || !hasValidItems) {
      alert("Campo obrigatório não preenchido");
      return;
    }

    setIsSaving(true);
    try {
      const { items, ...serviceData } = formData;
      
      // Auto-populate descricao_trabalho from items if empty or as a summary
      const firstItemDesc = items[0]?.descricao || '';
      const summary = items.length > 1 
        ? `${firstItemDesc} (+${items.length - 1} itens)`
        : firstItemDesc;

      const payload = {
        ...serviceData,
        descricao_trabalho: summary || formData.descricao_trabalho || 'Trabalho Protético',
        patient_id: Number(formData.patient_id),
        supplier_id: Number(formData.supplier_id),
        onus_repeticao: formData.onus_repeticao || null,
        created_by: user?.id
      };

      let currentServiceId: number;

      if (selectedService) {
        const { error } = await supabase
          .from('prosthetic_services')
          .update(payload)
          .eq('id', selectedService.id);
        if (error) throw error;
        currentServiceId = selectedService.id;

        // Log status change if needed
        if (selectedService.status !== formData.status) {
          const isAtLab = ['ABERTO', 'AJUSTE_REQUISITADO', 'REPETICAO'].includes(formData.status);
          await supabase.from('prosthetic_service_logs').insert({
            service_id: currentServiceId,
            status_anterior: selectedService.status,
            status_novo: formData.status,
            observacao: 'Status atualizado via formulário',
            local_atual: isAtLab ? 'LABORATORIO' : 'CLINICA',
            created_by: user?.id
          });
        }
      } else {
        const { data, error } = await supabase
          .from('prosthetic_services')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        currentServiceId = data.id;

        // Initial log
        await supabase.from('prosthetic_service_logs').insert({
          service_id: currentServiceId,
          status_novo: 'ABERTO',
          observacao: 'OS Iniciada na Clínica - Solicitada ao Laboratório',
          local_atual: 'CLINICA',
          created_by: user?.id
        });
      }

      // Handle items
      // For simplicity, we delete and re-insert for updates, or manage them more carefully
      if (selectedService) {
        await supabase
          .from('prosthetic_service_items')
          .delete()
          .eq('service_id', currentServiceId);
      }

      const itemsToInsert = items
        .filter(item => item.descricao.trim() !== '')
        .map(item => ({
          service_id: currentServiceId,
          descricao: item.descricao,
          valor: item.valor || 0
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('prosthetic_service_items')
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      await fetchInitialData();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Erro ao salvar OS: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchTimeline = async (serviceId: number) => {
    const { data } = await supabase
      .from('prosthetic_service_logs')
      .select('*')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false });
    if (data) setTimeline(data);
  };

  const handleOpenTimeline = async (service: ProstheticService) => {
    setSelectedService(service);
    await fetchTimeline(service.id);
    setIsTimelineOpen(true);
  };

  const handleExportQrPDF = () => {
    if (!selectedService) return;
    
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 120]
    });

    const patientName = (selectedService.patient as any)?.nome || 'N/A';
    const labName = (selectedService.supplier as any)?.nome || 'N/A';

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('GUIA DE ACOMPANHAMENTO', 40, 10, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(selectedService.referencia_os, 40, 18, { align: 'center' });

    // Include the actual QR Code if possible
    const canvas = document.querySelector('#qr-canvas-hidden canvas') as HTMLCanvasElement;
    if (canvas) {
      const qrImage = canvas.toDataURL('image/png');
      doc.addImage(qrImage, 'PNG', 20, 25, 40, 40);
    } else {
      doc.setDrawColor(200);
      doc.rect(20, 25, 40, 40);
      doc.setFontSize(8);
      doc.text('QR CODE', 40, 45, { align: 'center' });
    }

    doc.setFontSize(9);
    doc.text(`Paciente: ${patientName.substring(0, 30)}`, 10, 75);
    doc.text(`Laboratório: ${labName.substring(0, 30)}`, 10, 82);
    doc.text(`Data OS: ${new Date(selectedService.created_at).toLocaleDateString()}`, 10, 89);
    
    doc.line(10, 95, 70, 95);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Mantenha esta guia junto ao trabalho.', 40, 105, { align: 'center' });

    doc.save(`guia_${selectedService.referencia_os}.pdf`);
    setIsQrModalOpen(false);
  };

  const handlePrintCoupon = () => {
    if (!selectedService) return;

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const patientName = (selectedService.patient as any)?.nome || 'N/A';
    const labName = (selectedService.supplier as any)?.nome || 'N/A';
    const qrContent = document.querySelector('#qr-printable-area svg')?.outerHTML || '';
    const items = selectedService.items || [];

    const itemsHtml = items.map(item => `
      <div class="item-row">
        <div class="item-desc">${item.descricao}</div>
        <div class="item-val">${formatCurrency(item.valor)}</div>
      </div>
    `).join('');

    const content = `
      <html>
        <head>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              width: 72mm; 
              margin: 0 auto; 
              padding: 5mm 0; 
              font-family: 'Inter', -apple-system, system-ui, sans-serif;
              text-align: center;
              color: black;
              background: white;
            }
            .header { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
            .os-ref { font-size: 26px; font-weight: 900; margin: 5px 0; border-bottom: 3px solid black; padding-bottom: 5px; }
            .qr-container { margin: 10px auto; }
            .qr-container svg { width: 50mm; height: 50mm; }
            
            .info-block { text-align: left; font-size: 11px; margin: 10px 0; border-bottom: 0.5px solid #eee; padding-bottom: 8px; }
            .label { font-weight: 900; font-size: 9px; color: #555; text-transform: uppercase; margin-top: 5px; display: block; }
            .value { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
            
            .items-header { font-size: 10px; font-weight: 900; text-align: left; text-transform: uppercase; border-bottom: 1px solid black; margin-top: 10px; display: flex; justify-content: space-between; }
            .item-list { margin-top: 5px; text-align: left; }
            .item-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 0.2px dashed #ccc; }
            .item-desc { flex: 1; padding-right: 5px; font-weight: 500; }
            .item-val { font-weight: 700; white-space: nowrap; }
            
            .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; margin-top: 10px; padding: 10px 0; border-top: 1px solid black; border-bottom: 1px solid black; }
            
            .footer { font-size: 9px; margin-top: 20px; font-weight: 600; }
            .sub-footer { font-size: 8px; font-style: italic; color: #666; margin-top: 4px; }
            
            .divider { border-bottom: 1px dashed black; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">GUIA DE ACOMPANHAMENTO</div>
          <div class="os-ref">${selectedService.referencia_os}</div>
          
          <div class="qr-container">${qrContent}</div>
          
          <div class="info-block">
            <span class="label">Paciente</span>
            <div class="value">${patientName.toUpperCase()}</div>
            
            <span class="label">Laboratório</span>
            <div class="value">${labName.toUpperCase()}</div>
            
            <span class="label">Previsão Retorno</span>
            <div class="value">${selectedService.data_previsao ? new Date(selectedService.data_previsao).toLocaleDateString() : 'N/A'}</div>
          </div>

          <div class="items-header">
            <span>Descrição Item</span>
            <span>Valor</span>
          </div>
          <div class="item-list">
            ${itemsHtml}
          </div>

          <div class="total-row">
            <span>VALOR TOTAL:</span>
            <span>${formatCurrency(selectedService.valor_servico)}</span>
          </div>

          <div class="footer">
            Mantenha este cupom com o trabalho fisico.<br>
            SISTEMA DE GESTÃO PRAXIS
          </div>
          <div class="sub-footer">
            Emitido em ${new Date().toLocaleString()}
          </div>
          
          <script>
            window.onload = () => {
              window.focus();
              setTimeout(() => {
                window.print();
                setTimeout(() => { window.parent.document.body.removeChild(window.frameElement); }, 500);
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(content);
      doc.close();
    }
    
    setIsQrModalOpen(false);
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = 
      s.referencia_os.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.descricao_trabalho.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.patient as any)?.nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    let matchesUrgency = true;
    if (urgencyFilter !== 'ALL') {
      if (s.status === 'FINALIZADO' || !s.data_previsao) {
        matchesUrgency = false;
      } else {
        const now = new Date();
        const deadline = new Date(s.data_previsao);
        deadline.setHours(23, 59, 59, 999);
        
        if (urgencyFilter === 'OVERDUE') {
          matchesUrgency = deadline < now;
        } else if (urgencyFilter === 'NEAR_DEADLINE') {
          const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          matchesUrgency = diffDays >= 0 && diffDays <= 3;
        }
      }
    }
    
    return matchesSearch && matchesStatus && matchesUrgency;
  });
  
  const getUrgencyColor = (date?: string) => {
    if (!date) return 'text-slate-400';
    const now = new Date();
    const deadline = new Date(date);
    deadline.setHours(23, 59, 59, 999);
    const diff = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diff < 0) return 'text-red-600 font-bold';
    if (diff < 2) return 'text-orange-500 font-bold';
    return 'text-green-600';
  };

  const overdueCount = services.filter(s => {
    if (s.status === 'FINALIZADO' || !s.data_previsao) return false;
    const deadline = new Date(s.data_previsao);
    deadline.setHours(23, 59, 59, 999);
    return deadline < new Date();
  }).length;

  const nearDeadlineCount = services.filter(s => {
    if (s.status === 'FINALIZADO' || !s.data_previsao) return false;
    const now = new Date();
    const deadline = new Date(s.data_previsao);
    deadline.setHours(23, 59, 59, 999);
    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 3;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Serviços Protéticos</h1>
          <p className="text-slate-500">Controle de envio, recebimento e qualidade de trabalhos laboratoriais.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to="/relatorios/proteses"
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-200 transition-all font-bold text-sm shadow-sm"
          >
            <Activity className="w-4 h-4 text-blue-500" />
            Relatórios e Fechamento
          </Link>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            Nova OS
          </button>
        </div>
      </div>

      {/* Stats / Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Lab</p>
              <p className="text-xl font-black text-slate-900">
                {services.filter(s => ['ABERTO', 'AJUSTE_REQUISITADO', 'REPETICAO'].includes(s.status)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 rounded-lg">
              <User className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Na Clínica</p>
              <p className="text-xl font-black text-slate-900">
                {services.filter(s => s.status === 'RECEBIDO').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-lg">
              <RotateCcw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repetição</p>
              <p className="text-xl font-black text-slate-900">
                {services.filter(s => s.is_repeticao).length}
              </p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setUrgencyFilter(curr => curr === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={cn(
            "bg-white p-4 rounded-xl border shadow-sm border-l-4 transition-all text-left",
            urgencyFilter === 'OVERDUE' ? "border-red-500 ring-2 ring-red-500 ring-offset-2" : "border-slate-100 border-l-red-500 hover:border-red-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Vencidas</p>
              <p className="text-xl font-black text-red-700">
                {overdueCount}
              </p>
            </div>
          </div>
        </button>

        <button 
          onClick={() => setUrgencyFilter(curr => curr === 'NEAR_DEADLINE' ? 'ALL' : 'NEAR_DEADLINE')}
          className={cn(
            "bg-white p-4 rounded-xl border shadow-sm border-l-4 transition-all text-left",
            urgencyFilter === 'NEAR_DEADLINE' ? "border-orange-500 ring-2 ring-orange-500 ring-offset-2" : "border-slate-100 border-l-orange-500 hover:border-orange-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Prazo Curto</p>
              <p className="text-xl font-black text-orange-700">
                {nearDeadlineCount}
              </p>
            </div>
          </div>
        </button>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Finalizadas</p>
              <p className="text-xl font-black text-slate-900">
                {services.filter(s => s.status === 'FINALIZADO').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Pesquisar por OS, paciente ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            {urgencyFilter !== 'ALL' && (
              <button
                onClick={() => setUrgencyFilter('ALL')}
                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase transition-all hover:bg-blue-100"
              >
                Limpar Filtro Urgência
                <X className="w-3 h-3" />
              </button>
            )}
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos Status</option>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <option key={val} value={val}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 border-b border-slate-100 first:rounded-tl-2xl">Ordem de Serviço</th>
                <th className="px-6 py-4 border-b border-slate-100">Paciente / Trabalho</th>
                <th className="px-6 py-4 border-b border-slate-100">Laboratório</th>
                <th className="px-6 py-4 border-b border-slate-100">Status</th>
                <th className="px-6 py-4 border-b border-slate-100">Prazos</th>
                <th className="px-6 py-4 border-b border-slate-100 text-right last:rounded-tr-2xl">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Carregando serviços...
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Nenhum serviço encontrado.
                  </td>
                </tr>
              ) : filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="relative group/os">
                        <span className="text-xs font-black text-slate-900 cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">{service.referencia_os}</span>
                        <div className="absolute left-0 top-full mt-2 hidden group-hover/os:block z-[60] w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200 pointer-events-none">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-100 pb-1">Conteúdo da OS</p>
                          <div className="space-y-2">
                            {service.items && service.items.length > 0 ? (
                              service.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-2 text-left">
                                  <span className="text-[11px] text-slate-700 font-medium leading-tight flex-1">{item.descricao}</span>
                                  <span className="text-[10px] font-bold text-slate-900 whitespace-nowrap">{formatCurrency(item.valor)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">Nenhum item cadastrado.</p>
                            )}
                            <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Total:</span>
                              <span className="text-xs font-black text-blue-600">{formatCurrency(service.valor_servico)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(service.created_at).toLocaleDateString()}</span>
                      {service.is_repeticao && (
                        <span className="mt-1 text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 font-bold rounded uppercase w-fit">
                          Recall / Repetição
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{(service.patient as any)?.nome}</span>
                      <span className="text-xs text-slate-500 line-clamp-1">{service.descricao_trabalho}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">
                    {(service.supplier as any)?.nome}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const cfg = STATUS_CONFIG[service.status];
                      return (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                          cfg.bg, cfg.text
                        )}>
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className={getUrgencyColor(service.data_previsao)}>
                        {service.data_previsao ? new Date(service.data_previsao).toLocaleDateString() : 'Não definido'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                         onClick={() => {
                           setSelectedService(service);
                           setIsQrModalOpen(true);
                         }}
                         className="p-2 hover:bg-white text-slate-600 rounded-lg border border-transparent hover:border-slate-200"
                         title="Ver QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenTimeline(service)}
                        className="p-2 hover:bg-white text-slate-600 rounded-lg border border-transparent hover:border-slate-200"
                        title="Ver Histórico"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(service)}
                        className="p-2 hover:bg-white text-blue-600 rounded-lg border border-transparent hover:border-slate-200"
                        title="Editar"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      {(user?.role === 'ADMINISTRADOR' || user?.perfil?.permissions?.proteses?.excluir) && (
                        <button 
                          onClick={() => {
                            setSelectedService(service);
                            setIsConfirmOpen(true);
                          }}
                          className="p-2 hover:bg-white text-red-600 rounded-lg border border-transparent hover:border-slate-200"
                          title="Excluir OS"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-64" />
        </div>
      </div>

      {/* Main Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedService ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 relative">
              <label className="block text-sm font-bold text-slate-700 mb-1">Paciente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  required={!formData.patient_id}
                  placeholder="Pesquise o paciente pelo nome..."
                  value={patientSearch}
                  onFocus={() => setShowPatientResults(true)}
                  onBlur={() => setTimeout(() => setShowPatientResults(false), 200)}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    if (!e.target.value) {
                      setFormData(prev => ({ ...prev, patient_id: '' }));
                    }
                    setShowPatientResults(true);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              
              {showPatientResults && patientSearch && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {searchingPatients ? (
                    <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      Pesquisando na base completa...
                    </div>
                  ) : patientSearchResults.length > 0 ? (
                    patientSearchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, patient_id: p.id.toString() }));
                          setPatientSearch(p.nome);
                          setShowPatientResults(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                      >
                        {p.nome}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400 italic">Nenhum paciente encontrado</div>
                  )}
                </div>
              )}
              {/* Oculto para validação HTML5 required */}
              <input type="hidden" required value={formData.patient_id} />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">Laboratório (Fornecedor)</label>
              <select 
                required
                value={formData.supplier_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setFormData(prev => ({ ...prev, supplier_id: id }));
                  if (id) fetchExternalPrices(id);
                }}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              >
                <option value="">Selecione o Laboratório</option>
                {laboratories.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>

            <div className="col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-slate-700">Itens da Ordem de Serviço</label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    items: [...prev.items, { descricao: '', valor: 0 }] 
                  }))}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar Item
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-[3] relative">
                      <input 
                        required
                        value={item.descricao}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newItems = [...formData.items];
                          newItems[index].descricao = val;
                          setFormData(prev => ({ ...prev, items: newItems }));
                          // Inline search
                          if (val.length > 2 && formData.supplier_id) {
                            setSelectedItemIndex(index);
                            setPriceSearchTerm(val);
                          }
                        }}
                        onFocus={() => {
                          if (item.descricao.length > 0 && formData.supplier_id) {
                            setSelectedItemIndex(index);
                            setPriceSearchTerm(item.descricao);
                          }
                        }}
                        onBlur={() => {
                          // Timeout to allow clicking a suggestion before closing
                          setTimeout(() => setSelectedItemIndex(null), 200);
                        }}
                        placeholder="Descrição do item..."
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium pr-10"
                      />
                      
                      {/* Inline Suggestions */}
                      {selectedItemIndex === index && priceSearchTerm.length > 2 && (
                        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                          {(() => {
                            const filtered = externalPriceItems
                              .filter(i => i.name.toLowerCase().includes(priceSearchTerm.toLowerCase()))
                              .slice(0, 5);
                            
                            if (filtered.length === 0) {
                              return (
                                <div className="px-4 py-3 text-xs text-slate-400 italic bg-slate-50">
                                  Item não encontrado na tabela. Continue digitando para entrada manual.
                                </div>
                              );
                            }

                            return filtered.map(suggestion => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()} // Prevents blur before click
                                onClick={() => {
                                  const newItems = [...formData.items];
                                  newItems[index] = {
                                    ...newItems[index],
                                    descricao: suggestion.name,
                                    valor: suggestion.price
                                  };
                                  const total = newItems.reduce((acc, i) => acc + (i.valor || 0), 0);
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    items: newItems,
                                    valor_servico: total
                                  }));
                                  setSelectedItemIndex(null);
                                  setPriceSearchTerm('');
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{suggestion.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono text-xs">REF: {suggestion.id.substring(0,8)}</p>
                                </div>
                                <span className="text-xs font-black text-blue-600">{formatCurrency(suggestion.price)}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      )}

                      {formData.supplier_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemIndex(index);
                            setPriceSearchTerm('');
                            // Se não carregou nada, tenta carregar agora
                            if (externalPriceItems.length === 0) {
                              fetchExternalPrices(formData.supplier_id);
                            }
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          title="Buscar na tabela de preços completa"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1">
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={item.valor}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].valor = Number(e.target.value);
                          const total = newItems.reduce((acc, i) => acc + (i.valor || 0), 0);
                          setFormData(prev => ({ 
                            ...prev, 
                            items: newItems,
                            valor_servico: total
                          }));
                        }}
                        placeholder="Valor"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = formData.items.filter((_, i) => i !== index);
                          const total = newItems.reduce((acc, i) => acc + (i.valor || 0), 0);
                          setFormData(prev => ({ 
                            ...prev, 
                            items: newItems,
                            valor_servico: total
                          }));
                        }}
                        className="p-2 mt-1 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">Observações Gerais</label>
              <textarea 
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Ex: Observações adicionais para o laboratório..."
                className="w-full h-20 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Valor Total (Automático)</label>
              <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-900">
                {formatCurrency(formData.valor_servico)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Previsão de Retorno</label>
              <input 
                type="date"
                required
                value={formData.data_previsao}
                onChange={(e) => setFormData(prev => ({ ...prev, data_previsao: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Status Atual</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProstheticStatus }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              >
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.is_repeticao}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_repeticao: e.target.checked }))}
                  className="w-4 h-4 rounded text-red-600 border-slate-300"
                />
                <span className="text-sm font-bold text-slate-700">Repetição / Recall</span>
              </label>
            </div>

            {formData.is_repeticao && (
              <div className="col-span-2 bg-red-50 p-4 rounded-xl border border-red-100">
                <label className="block text-sm font-bold text-red-700 mb-2">Ônus da Repetição (Quem assume o custo?)</label>
                <div className="flex gap-4">
                  {(['CLINICA', 'LABORATORIO', 'PACIENTE'] as const).map(onus => (
                    <label key={onus} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio"
                        name="onus"
                        value={onus}
                        checked={formData.onus_repeticao === onus}
                        onChange={(e) => setFormData(prev => ({ ...prev, onus_repeticao: e.target.value as any }))}
                        className="text-red-600"
                      />
                      <span className="text-xs font-bold text-slate-600">{onus}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <div>
              {selectedService && (user?.role === 'ADMINISTRADOR' || user?.perfil?.permissions?.proteses?.excluir) && (
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(true)}
                  className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir OS
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar OS
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Timeline Modal */}
      <Modal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        title="Histórico de Movimentação (Timeline)"
        size="md"
      >
        <div className="space-y-6">
          {timeline.length === 0 ? (
             <div className="text-center py-12 text-slate-400 italic">Sem registros de movimentação.</div>
          ) : (
            <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              {timeline.map((log) => (
                <div key={log.id} className="relative pl-10">
                  <div className={cn(
                    "absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                    log.status_novo === 'FINALIZADO' ? "bg-green-500" : "bg-blue-500"
                  )} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 uppercase">
                        {log.status_novo}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Local:</span>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                           {log.local_atual}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{log.observacao || 'Nenhuma observação informada.'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal
         isOpen={isQrModalOpen}
         onClose={() => setIsQrModalOpen(false)}
         title="Guia de Acompanhamento"
         size="sm"
      >
         <div id="qr-printable-area" className="flex flex-col items-center text-center p-6 space-y-6">
            {/* Hidden canvas for PDF export */}
            <div id="qr-canvas-hidden" className="hidden">
               <QRCodeCanvas 
                  value={selectedService?.id.toString() || ''} 
                  size={400}
                  level="H"
               />
            </div>
            <div className="p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
               <QRCodeSVG 
                  value={selectedService?.id.toString() || ''} 
                  size={180}
                  level="H"
                  includeMargin
               />
            </div>
            
            <div className="space-y-2">
               <p className="text-xl font-black text-slate-900">{selectedService?.referencia_os}</p>
               <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-600">{(selectedService?.patient as any)?.nome}</span>
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">{(selectedService?.supplier as any)?.nome}</span>
               </div>
            </div>

            <div className="w-full bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
               <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Itens do Serviço</p>
               <div className="space-y-2">
                  {selectedService?.items?.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-start text-left">
                        <span className="text-xs text-slate-700 font-medium leading-tight flex-1 pr-4">{item.descricao}</span>
                        <span className="text-xs font-bold text-slate-900">{formatCurrency(item.valor)}</span>
                     </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-500 uppercase">Total:</span>
                     <span className="text-sm font-black text-blue-600">{formatCurrency(selectedService?.valor_servico || 0)}</span>
                  </div>
               </div>
            </div>

            <div className="w-full py-2">
               <p className="text-[10px] text-slate-400 font-bold uppercase italic">
                  Esta guia deve acompanhar o trabalho físico.
               </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full print:hidden">
              <button 
                 onClick={handleExportQrPDF}
                 className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-slate-50 transition-all text-sm"
              >
                 <FileText className="w-4 h-4 text-blue-500" />
                 PDF
              </button>
              <button 
                 onClick={handlePrintCoupon}
                 className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-all text-sm"
              >
                 <QrCode className="w-4 h-4 text-blue-400" />
                 Cupom
              </button>
            </div>
         </div>

      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Ordem de Serviço"
        message="Tem certeza que deseja excluir esta OS e todo o seu histórico? Esta ação é irreversível."
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="danger"
        loading={isDeleting}
      />

      {/* Price Item Selection Modal */}
      <Modal
        isOpen={selectedItemIndex !== null}
        onClose={() => setSelectedItemIndex(null)}
        title="Tabela de Preços Externa"
        size="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Pesquisar item na tabela..."
              value={priceSearchTerm}
              onChange={(e) => setPriceSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
          
          <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {isSearchingPrices ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                Buscando preços...
              </div>
            ) : externalPriceItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="italic mb-4">Nenhum item encontrado na tabela de preços deste laboratório.</p>
                <button
                  type="button"
                  onClick={() => fetchExternalPrices(formData.supplier_id)}
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors"
                >
                  Tentar carregar novamente
                </button>
              </div>
            ) : (() => {
                const filtered = externalPriceItems.filter(item => 
                  item.name?.toLowerCase().includes(priceSearchTerm.toLowerCase())
                );
                
                if (filtered.length === 0) {
                  return <div className="p-8 text-center text-slate-400 font-medium">Nenhum item corresponde à pesquisa</div>;
                }

                return filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const newItems = [...formData.items];
                      if (selectedItemIndex !== null) {
                        newItems[selectedItemIndex] = {
                          ...newItems[selectedItemIndex],
                          descricao: item.name,
                          valor: item.price
                        };
                        const total = newItems.reduce((acc, i) => acc + (i.valor || 0), 0);
                        setFormData(prev => ({ 
                          ...prev, 
                          items: newItems,
                          valor_servico: total
                        }));
                      }
                      setSelectedItemIndex(null);
                      setPriceSearchTerm('');
                    }}
                    className="w-full text-left p-4 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">REF: {String(item.id).substring(0, 8)}</p>
                    </div>
                    <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </button>
                ));
            })()}
          </div>
        </div>
      </Modal>
    </div>
  );
}
