import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Save, Loader2, Image as ImageIcon, DollarSign, Calculator } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function Settings() {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [defaultSalesPercent, setDefaultSalesPercent] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data: logoData } = await supabase
      .from('Setting')
      .select('*')
      .eq('key', 'logo_url')
      .single();
    
    if (logoData) setLogoUrl(logoData.value);

    const { data: percentData } = await supabase
      .from('Setting')
      .select('*')
      .eq('key', 'default_sales_percent')
      .single();
    
    if (percentData) setDefaultSalesPercent(Number(percentData.value));
  }

  // Permission check
  const permissions = user?.perfil?.permissions?.configuracoes;
  const canView = user?.role === 'ADMINISTRADOR' || permissions?.visualizar;
  const canEdit = user?.role === 'ADMINISTRADOR' || permissions?.editar;

  if (!canView) {
    return <Navigate to="/" />;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      
      // Save to Settings table
      const { error: upsertError } = await supabase
        .from('Setting')
        .upsert({ key: 'logo_url', value: publicUrl }, { onConflict: 'key' });

      if (upsertError) throw upsertError;

      setMessage({ type: 'success', text: 'Logo atualizada com sucesso!' });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setMessage({ type: 'error', text: 'Erro ao fazer upload da logo: ' + (error.message || 'Erro desconhecido') });
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveFinancialSettings() {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('Setting')
        .upsert({ key: 'default_sales_percent', value: String(defaultSalesPercent) }, { onConflict: 'key' });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Configurações financeiras salvas com sucesso!' });
    } catch (error: any) {
      console.error('Error saving financial settings:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações: ' + (error.message || 'Erro desconhecido') });
    } finally {
      setSaving(false);
    }
  }

  const [recalculating, setRecalculating] = useState(false);
  const [isConfirmRecalculateOpen, setIsConfirmRecalculateOpen] = useState(false);

  async function handleRecalculateAllPrices() {
    try {
      setRecalculating(true);
      setIsConfirmRecalculateOpen(false);
      
      // 1. Fetch all materials
      const { data: materials, error: fetchError } = await supabase
        .from('Material')
        .select('*')
        .not('valor_unitario', 'is', null);

      if (fetchError) throw fetchError;

      if (!materials || materials.length === 0) {
        setMessage({ type: 'error', text: 'Nenhum material com valor unitário encontrado para atualizar.' });
        return;
      }

      // 2. Prepare updates (spreading original object to preserve all required fields)
      const updates = materials.map(m => ({
        ...m,
        percentual_venda: defaultSalesPercent,
        preco_venda: Number(m.valor_unitario || 0) * (1 + defaultSalesPercent / 100)
      }));

      // 3. Perform bulk update via upsert (Supabase handles this as a bulk update if IDs match)
      // Note: We only include the fields we want to change
      const { error: updateError } = await supabase
        .from('Material')
        .upsert(updates);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: `${materials.length} materiais atualizados com sucesso!` });
    } catch (error: any) {
      console.error('Error recalculating prices:', error);
      setMessage({ type: 'error', text: 'Erro ao recalcular preços: ' + (error.message || 'Erro desconhecido') });
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Personalize o sistema e gerencie preferências globais.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Identidade Visual</h2>
          <p className="text-sm text-slate-500">Esta logo será exibida na barra lateral e nos relatórios.</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative group">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-300" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                {canEdit ? (
                  <>
                    <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {logoUrl ? 'Alterar Logo' : 'Fazer Upload'}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleLogoUpload}
                        disabled={uploading}
                      />
                    </label>
                    {logoUrl && (
                      <button 
                        onClick={async () => {
                          await supabase.from('Setting').delete().eq('key', 'logo_url');
                          setLogoUrl(null);
                        }}
                        className="text-red-600 text-sm font-medium hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-slate-500 italic">Você não tem permissão para alterar a logo.</span>
                )}
              </div>
              <p className="text-xs text-slate-400">Recomendado: PNG ou SVG com fundo transparente. Tamanho máx: 2MB.</p>
            </div>
          </div>

          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={cn(
                "p-4 rounded-lg text-sm font-medium",
                message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
              )}
            >
              {message.text}
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900">Financeiro</h2>
          </div>
          {canEdit && (
            <button
              onClick={handleSaveFinancialSettings}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          )}
        </div>
        <div className="p-8 space-y-6">
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1">Percentual de Venda Padrão (%)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                disabled={!canEdit}
                value={defaultSalesPercent}
                onChange={(e) => setDefaultSalesPercent(Number(e.target.value))}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Este percentual será sugerido ao cadastrar novos materiais para calcular o preço de venda.</p>
          </div>

          {canEdit && (
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsConfirmRecalculateOpen(true)}
                disabled={recalculating}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                Recalcular Preço de Venda em Todos os Materiais
              </button>
              <p className="mt-2 text-xs text-slate-400 italic">
                Ação em massa: Atualiza o preço de venda de todos os itens cadastrados usando o percentual acima.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Configurações do Sistema</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="font-semibold text-slate-900">Notificações de Estoque Baixo</p>
              <p className="text-sm text-slate-500">Alertar quando itens atingirem o estoque mínimo.</p>
            </div>
            <div className="w-12 h-6 bg-blue-600 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmRecalculateOpen}
        onClose={() => setIsConfirmRecalculateOpen(false)}
        onConfirm={handleRecalculateAllPrices}
        loading={recalculating}
        title="Recalcular Preços de Venda"
        message="Tem certeza que deseja recalcular o preço de venda de TODOS os materiais com base no percentual padrão? Esta ação atualizará o percentual e o preço de venda de cada item e não pode ser desfeita."
        confirmText="Sim, Recalcular Tudo"
        variant="warning"
      />
    </div>
  );
}
