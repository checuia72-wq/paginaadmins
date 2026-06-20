import React, { useState, useEffect } from 'react';
import { getPlanes, getClientes, createCliente, updateCliente, createReserva } from '../services/api.service';

const ReservaRapidaPage = () => {
  const [telefono, setTelefono] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
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

    if (!telefono || !selectedPlan) {
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
        cantidad_personas: 1,
        aprobado: false
      });

      // Mostrar éxito
      setSuccess(true);
      
      // Resetear formulario
      setTelefono('');
      setSelectedPlan('');

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
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        <div className="overview-header mb-8">
          <div>
            <h1 className="overview-title">Reserva Rápida</h1>
            <p className="overview-sub">
              Crea una reserva en segundos.
            </p>
          </div>
        </div>

        {/* Mensajes de éxito/error */}
        {success && (
          <div className="card mb-8 border-l-4 border-l-green-500">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">✅</span>
                <span className="font-bold text-xl text-[var(--text-primary)]">¡Perfecto!</span>
              </div>
              <p className="text-[var(--text-secondary)]">Reserva creada exitosamente</p>
            </div>
          </div>
        )}
        {error && (
          <div className="card mb-8 border-l-4 border-l-red-500">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">❌</span>
                <span className="font-bold text-xl text-[var(--text-primary)]">¡Error!</span>
              </div>
              <p className="text-[var(--text-secondary)]">{error}</p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Teléfono */}
              <div className="rv-form-group">
                <label>Teléfono de contacto *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-medium">🇨🇴 +57</span>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="300 000 0000"
                    className="w-full pl-24"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Usa tu número de WhatsApp.
                </p>
              </div>

              {/* Plan */}
              <div className="rv-form-group">
                <label>¿Qué experiencia buscas? *</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  <option value="">Selecciona un plan turístico</option>
                  {loading ? (
                    <option disabled>Cargando planes...</option>
                  ) : planes.length === 0 ? (
                    <option disabled>No hay planes disponibles</option>
                  ) : (
                    planes.map(plan => (
                      <option key={plan.id_plan} value={plan.id_plan}>
                        {plan.nombre_plan} {plan.precio_plan ? `- $${Number(plan.precio_plan).toLocaleString('es-CO')} COP` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Plan seleccionado info */}
              {selectedPlan && (
                <div className="bg-[var(--amber-bg)] border-l-4 border-[var(--amber)] p-4 rounded-r-lg">
                  {(() => {
                    const plan = planes.find(p => p.id_plan.toString() === selectedPlan);
                    return plan ? (
                      <div>
                        <p className="font-bold text-[var(--text-primary)]">{plan.nombre_plan}</p>
                        {plan.precio_plan && (
                          <p className="text-[var(--amber)] font-semibold">
                            ${Number(plan.precio_plan).toLocaleString('es-CO')} COP
                          </p>
                        )}
                        {plan.descripcion_basica && (
                          <p className="text-sm text-[var(--text-secondary)] mt-1">{plan.descripcion_basica}</p>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Política de datos */}
              <div className="pt-4">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                  Autorizo el tratamiento de mis datos personales de acuerdo con la política de datos de la empresa.
                </p>

                {/* Checkbox de aceptación */}
                <div className="rv-form-check">
                  <input
                    type="checkbox"
                    id="accept"
                    required
                  />
                  <label htmlFor="accept">
                    He leído y acepto la política de tratamiento de datos.
                  </label>
                </div>
              </div>

              {/* Botón continuar */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!telefono || !selectedPlan}
                  className="rv-btn-new w-full justify-center"
                >
                  ✦ Continuar ✦
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservaRapidaPage;
