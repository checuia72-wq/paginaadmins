import React, { useState, useEffect, useRef } from 'react';
import { getPlanes, getClientes, createCliente, updateCliente, createReserva } from '../services/api.service';

const COUNTRIES = [
  { flag: '🇨🇴', name: 'Colombia', dial: '+57' },
  { flag: '🇲🇽', name: 'México', dial: '+52' },
  { flag: '🇻🇪', name: 'Venezuela', dial: '+58' },
  { flag: '🇪🇨', name: 'Ecuador', dial: '+593' },
  { flag: '🇵🇪', name: 'Perú', dial: '+51' },
  { flag: '🇨🇱', name: 'Chile', dial: '+56' },
  { flag: '🇦🇷', name: 'Argentina', dial: '+54' },
  { flag: '🇧🇷', name: 'Brasil', dial: '+55' },
  { flag: '🇺🇸', name: 'EE.UU.', dial: '+1' },
  { flag: '🇪🇸', name: 'España', dial: '+34' },
  { flag: '🇵🇦', name: 'Panamá', dial: '+507' },
  { flag: '🇧🇴', name: 'Bolivia', dial: '+591' },
  { flag: '🇵🇾', name: 'Paraguay', dial: '+595' },
  { flag: '🇺🇾', name: 'Uruguay', dial: '+598' },
  { flag: '🇨🇷', name: 'Costa Rica', dial: '+506' },
];

type ClienteStatus = 'idle' | 'checking' | 'found' | 'new';

const ReservaRapidaPage = () => {
  const [telefono, setTelefono] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [planes, setPlanes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [clienteStatus, setClienteStatus] = useState<ClienteStatus>('idle');
  const [clienteEncontrado, setClienteEncontrado] = useState<any>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [planesData, clientesData] = await Promise.all([getPlanes(), getClientes()]);
        setPlanes(planesData);
        setClientes(clientesData);
      } catch (err) {
        console.error('Error al cargar datos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Verificación con debounce al escribir el teléfono
  useEffect(() => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    const num = telefono.trim().replace(/\s/g, '');
    if (num.length < 7) {
      setClienteStatus('idle');
      setClienteEncontrado(null);
      return;
    }

    setClienteStatus('checking');
    checkTimerRef.current = setTimeout(() => {
      const fullPhone = `${selectedCountry.dial.replace('+', '')}${num}`;
      const found = clientes.find(
        c => c.telefono === num || c.telefono === fullPhone || c.telefono === `${selectedCountry.dial}${num}`
      );
      if (found) {
        setClienteStatus('found');
        setClienteEncontrado(found);
      } else {
        setClienteStatus('new');
        setClienteEncontrado(null);
      }
    }, 700);
  }, [telefono, selectedCountry, clientes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!telefono || !selectedPlan) {
      setError('Por favor completa todos los campos');
      return;
    }

    const fullPhone = `${selectedCountry.dial}${telefono.trim().replace(/\s/g, '')}`;

    try {
      if (clienteEncontrado) {
        // Cliente existente: actualizar
        await updateCliente(clienteEncontrado.telefono, {
          atencion_humana: true,
          id_plan: parseInt(selectedPlan),
        });
      } else {
        // Cliente nuevo: crear
        await createCliente({
          telefono: fullPhone,
          atencion_humana: true,
          id_plan: parseInt(selectedPlan),
          etapaconversacion: 'saludo',
        });
      }

      await createReserva({
        telefono_cliente: clienteEncontrado ? clienteEncontrado.telefono : fullPhone,
        id_plan: parseInt(selectedPlan),
        cantidad_personas: 1,
        aprobado: false,
      });

      setSuccess(true);
      setTelefono('');
      setSelectedPlan('');
      setAccepted(false);
      setClienteStatus('idle');
      setClienteEncontrado(null);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Ocurrió un error al procesar la reserva');
    }
  };

  const planSeleccionado = planes.find(p => p.id_plan.toString() === selectedPlan);
  const canSubmit = telefono.length >= 7 && selectedPlan && accepted && clienteStatus !== 'checking' && clienteStatus !== 'idle';

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Reserva rápida</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Completa tu información y elige una experiencia para comenzar.
          </p>
        </div>

        {/* Alerta éxito */}
        {success && (
          <div className="flex items-start gap-3 p-4 rounded-xl mb-6 bg-green-50 border border-green-200 text-green-800">
            <span className="text-xl leading-none mt-0.5">✅</span>
            <div>
              <p className="font-semibold">¡Reserva creada!</p>
              <p className="text-sm text-green-700 mt-0.5">Pronto nos comunicaremos contigo por WhatsApp.</p>
            </div>
          </div>
        )}

        {/* Alerta error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl mb-6 bg-red-50 border border-red-200 text-red-800">
            <span className="text-xl leading-none mt-0.5">❌</span>
            <div>
              <p className="font-semibold">Algo salió mal</p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Teléfono ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Teléfono de contacto <span className="text-red-500">*</span>
                </label>

                {/* Input compuesto */}
                <div
                  className="flex rounded-lg border border-[var(--border)] overflow-visible focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-[var(--accent)] transition-all"
                  style={{ position: 'relative' }}
                >
                  {/* Selector de país */}
                  <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(o => !o)}
                      className="flex items-center gap-2 px-3 h-11 bg-[var(--surface-secondary)] border-r border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors rounded-l-lg text-sm font-medium text-[var(--text-primary)] whitespace-nowrap"
                    >
                      <span className="text-lg leading-none">{selectedCountry.flag}</span>
                      <span className="text-[var(--text-secondary)]">{selectedCountry.dial}</span>
                      <svg
                        className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Dropdown países */}
                    {dropdownOpen && (
                      <div
                        className="absolute left-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg overflow-auto"
                        style={{ width: 230, maxHeight: 240 }}
                      >
                        {COUNTRIES.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setSelectedCountry(c); setDropdownOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left ${c === selectedCountry ? 'bg-[var(--surface-secondary)]' : ''}`}
                          >
                            <span className="text-lg leading-none">{c.flag}</span>
                            <span className="flex-1 text-[var(--text-primary)]">{c.name}</span>
                            <span className="text-xs text-[var(--text-muted)] font-medium">{c.dial}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input número */}
                  <input
                    type="tel"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="300 000 0000"
                    className="flex-1 h-11 px-3 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                  />

                  {/* Indicador de verificación */}
                  {clienteStatus === 'checking' && (
                    <div className="flex items-center pr-3">
                      <svg className="animate-spin h-4 w-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                  )}
                  {clienteStatus === 'found' && (
                    <div className="flex items-center pr-3 text-green-600">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {clienteStatus === 'new' && (
                    <div className="flex items-center pr-3 text-blue-500">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Badge de estado del cliente */}
                {clienteStatus === 'found' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <span><strong>Cliente existente</strong> — la reserva se vinculará a esta cuenta.</span>
                  </div>
                )}
                {clienteStatus === 'new' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    <span><strong>Número nuevo</strong> — se creará un perfil al confirmar.</span>
                  </div>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  Usa el mismo número de WhatsApp para recibir confirmaciones.
                </p>
              </div>

              {/* ── Plan ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  ¿Qué experiencia buscas? <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                  }}
                >
                  <option value="">Selecciona un plan turístico</option>
                  {planes.map(plan => (
                    <option key={plan.id_plan} value={plan.id_plan}>
                      {plan.nombre_plan}
                      {plan.precio_plan ? ` — $${Number(plan.precio_plan).toLocaleString('es-CO')} COP` : ''}
                    </option>
                  ))}
                </select>

                {/* Info del plan seleccionado */}
                {planSeleccionado && (
                  <div className="mt-2 p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{planSeleccionado.nombre_plan}</p>
                    {planSeleccionado.precio_plan && (
                      <p className="text-base font-semibold text-green-600 mt-1">
                        ${Number(planSeleccionado.precio_plan).toLocaleString('es-CO')} COP
                      </p>
                    )}
                    {planSeleccionado.descripcion_basica && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                        {planSeleccionado.descripcion_basica}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Política ── */}
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                  Autorizo el tratamiento de mis datos personales de acuerdo con la política de privacidad de la empresa y la Ley 1581 de 2012.
                </p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={e => setAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-green-600 cursor-pointer"
                  />
                  <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    He leído y acepto el tratamiento de datos personales.
                  </span>
                </label>
              </div>

              {/* ── Botón ── */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                  ${canSubmit
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                  }`}
              >
                {clienteStatus === 'checking' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
                    </svg>
                    Confirmar reserva
                  </>
                )}
              </button>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservaRapidaPage;