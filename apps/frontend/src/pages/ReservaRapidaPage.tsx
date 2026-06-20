import React, { useState, useEffect } from 'react';
import { getPlanes, getClientes, createCliente, updateCliente, createReserva } from '../services/api.service';

const ReservaRapidaPage = () => {
  const [telefono, setTelefono] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [cantidadPersonas, setCantidadPersonas] = useState<string>('1');
  const [planes, setPlanes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Cargar datos iniciales
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!telefono || !selectedPlan || !cantidadPersonas) {
      setError('Por favor completa todos los campos');
      return;
    }

    try {
      // Verificar si el cliente existe
      const clienteExistente = clientes.find(c => c.telefono === telefono);

      if (clienteExistente) {
        // Actualizar cliente: atencion_humana = true y setear id_plan
        await updateCliente(telefono, {
          atencion_humana: true,
          id_plan: parseInt(selectedPlan)
        });
      } else {
        // Crear nuevo cliente
        await createCliente({
          telefono,
          atencion_humana: true,
          id_plan: parseInt(selectedPlan),
          etapaconversacion: 'saludo'
        });
      }

      // Crear la reserva
      await createReserva({
        telefono_cliente: telefono,
        id_plan: parseInt(selectedPlan),
        cantidad_personas: parseInt(cantidadPersonas),
        aprobado: false
      });

      // Mostrar éxito
      setSuccess(true);
      
      // Resetear formulario
      setTelefono('');
      setSelectedPlan('');
      setCantidadPersonas('1');

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Ocurrió un error al procesar la reserva');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]">
      <div className="w-full max-w-lg bg-[#1e293b] rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-700 relative">
        {/* Barra superior verde */}
        <div className="h-2 bg-gradient-to-r from-[#8fb15d] via-[#a8d06a] to-[#8fb15d]"></div>

        <div className="p-8 md:p-10">
          <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-3 tracking-tight">
            BIENVENIDO A CHECUA
          </h1>
          <p className="text-gray-400 text-center mb-10 text-sm font-medium">
            Por favor completa estos datos para iniciar tu reserva.
          </p>

          {/* Mensajes de éxito/error */}
          {success && (
            <div className="mb-8 p-5 bg-green-900/20 border-2 border-green-500/30 rounded-2xl text-green-200 text-center backdrop-blur-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">✅</span>
                <span className="font-bold text-lg">¡Perfecto!</span>
              </div>
              <p className="text-sm">Reserva creada exitosamente</p>
            </div>
          )}
          {error && (
            <div className="mb-8 p-5 bg-red-900/20 border-2 border-red-500/30 rounded-2xl text-red-200 text-center backdrop-blur-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">❌</span>
                <span className="font-bold text-lg">¡Error!</span>
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            {/* Teléfono */}
            <div className="space-y-3">
              <label className="block text-[#8fb15d] font-black uppercase text-[11px] tracking-[0.3em]">
                Teléfono de contacto *
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="text-white font-black text-lg">🇨🇴</span>
                  <span className="text-white font-bold ml-2">+57</span>
                </div>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="300 000 0000"
                  className="w-full pl-28 pr-5 py-5 bg-[#0f172a]/80 border-2 border-gray-600/50 rounded-[2rem] text-white placeholder-gray-400/60 focus:outline-none focus:border-[#8fb15d] focus:bg-[#0f172a] focus:ring-4 focus:ring-[#8fb15d]/10 transition-all duration-300 font-medium text-lg"
                />
              </div>
              <p className="text-gray-400/80 text-xs mt-2 ml-2 font-medium">
                Usa tu número de WhatsApp.
              </p>
            </div>

            {/* Cantidad de personas */}
            <div className="space-y-3">
              <label className="block text-[#8fb15d] font-black uppercase text-[11px] tracking-[0.3em]">
                Cantidad de personas *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={cantidadPersonas}
                  onChange={(e) => setCantidadPersonas(e.target.value)}
                  placeholder="1"
                  className="w-full px-5 py-5 bg-[#0f172a]/80 border-2 border-gray-600/50 rounded-[2rem] text-white placeholder-gray-400/60 focus:outline-none focus:border-[#8fb15d] focus:bg-[#0f172a] focus:ring-4 focus:ring-[#8fb15d]/10 transition-all duration-300 font-medium text-lg"
                />
              </div>
            </div>

            {/* Plan - Mejorado */}
            <div className="space-y-3">
              <label className="block text-[#8fb15d] font-black uppercase text-[11px] tracking-[0.3em]">
                ¿Qué experiencia buscas? *
              </label>
              
              {/* Plan seleccionado (si hay uno) */}
              {selectedPlan && (
                <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {(() => {
                    const plan = planes.find(p => p.id_plan.toString() === selectedPlan);
                    return plan ? (
                      <div className="bg-[#8fb15d]/10 border-2 border-[#8fb15d]/30 rounded-[2rem] p-6 flex items-center justify-between gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#8fb15d]/10 rounded-full -mr-16 -mt-16"></div>
                        <div className="relative z-10">
                          <p className="text-[10px] uppercase tracking-[0.25em] font-black text-[#8fb15d] mb-1">Plan seleccionado</p>
                          <p className="text-white font-black text-xl">{plan.nombre_plan}</p>
                          {plan.precio_plan && (
                            <p className="text-[#8fb15d] font-bold text-lg mt-1">
                              ${Number(plan.precio_plan).toLocaleString('es-CO')} COP
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPlan('')}
                          className="relative z-10 w-10 h-10 rounded-full bg-[#1e293b] border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-[#8fb15d] transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Selector de planes */}
              {!selectedPlan && (
                <div className="grid gap-3">
                  {loading ? (
                    <div className="bg-[#0f172a]/80 border-2 border-dashed border-gray-600/50 rounded-[2rem] p-10 text-center">
                      <div className="w-10 h-10 border-4 border-[#8fb15d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-sm text-gray-400/80 font-medium">Cargando planes...</p>
                    </div>
                  ) : planes.length === 0 ? (
                    <div className="bg-[#0f172a]/80 border-2 border-dashed border-gray-600/50 rounded-[2rem] p-10 text-center">
                      <p className="text-sm text-gray-400/80 font-medium italic">No hay planes disponibles</p>
                    </div>
                  ) : (
                    planes.map(plan => (
                      <button
                        key={plan.id_plan}
                        type="button"
                        onClick={() => setSelectedPlan(plan.id_plan.toString())}
                        className="group w-full text-left p-5 bg-[#0f172a]/60 border-2 border-gray-600/30 rounded-[2rem] hover:border-[#8fb15d] hover:bg-[#0f172a]/90 transition-all duration-300 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-[#8fb15d] transition-all duration-300"></div>
                        <div className="relative z-10">
                          <p className="text-white font-bold text-lg">{plan.nombre_plan}</p>
                          {plan.precio_plan && (
                            <p className="text-[#8fb15d] font-semibold text-sm mt-1">
                              ${Number(plan.precio_plan).toLocaleString('es-CO')} COP
                            </p>
                          )}
                          {plan.descripcion_basica && (
                            <p className="text-gray-400/80 text-sm mt-2">{plan.descripcion_basica}</p>
                          )}
                        </div>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 border-2 border-gray-600 rounded-full group-hover:border-[#8fb15d] flex items-center justify-center transition-all">
                          <div className="w-3 h-3 rounded-full bg-transparent group-hover:bg-[#8fb15d] transition-all"></div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Política de datos */}
            <div className="pt-4">
              <p className="text-gray-400/70 text-xs leading-relaxed mb-4">
                Autorizo el tratamiento de mis datos personales de acuerdo con la política de datos de la empresa.
              </p>

              {/* Checkbox de aceptación */}
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    id="accept"
                    required
                    className="peer sr-only"
                  />
                  <div className="w-7 h-7 border-2 border-gray-600 rounded-lg bg-[#0f172a] peer-checked:bg-[#8fb15d] peer-checked:border-[#8fb15d] transition-all duration-300 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-white text-sm font-semibold pt-1 select-none group-hover:text-[#8fb15d] transition-colors">
                  He leído y acepto la política de tratamiento de datos.
                </span>
              </label>
            </div>

            {/* Botón continuar */}
            <button
              type="submit"
              disabled={!telefono || !selectedPlan || !cantidadPersonas}
              className="w-full py-5 bg-gradient-to-r from-[#8fb15d] via-[#a8d06a] to-[#8fb15d] text-white font-black text-xl rounded-[2rem] uppercase tracking-[0.2em] hover:shadow-[0_0_30px_rgba(143,177,93,0.4)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              ✦ CONTINUAR ✦
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReservaRapidaPage;
