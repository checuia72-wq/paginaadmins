import React, { useState, useEffect } from 'react';
import { getPlanes, getClientes, createCliente, updateCliente, createReserva } from '../services/api.service';

const ReservaRapidaPage = () => {
  const [telefono, setTelefono] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f172a]">
      <div className="w-full max-w-md bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-gray-700">
        {/* Barra superior verde */}
        <div className="h-2 bg-[#8fb15d]"></div>

        <div className="p-8">
          <h1 className="text-3xl font-bold text-white text-center mb-2">BIENVENIDO A CHECUA</h1>
          <p className="text-gray-400 text-center mb-8 text-sm">Por favor completa estos datos para iniciar tu reserva.</p>

          {/* Mensajes de éxito/error */}
          {success && (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-500 rounded-xl text-green-200 text-center">
              ✅ Cliente registrado exitosamente!
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-xl text-red-200 text-center">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Teléfono */}
            <div>
              <label className="block text-[#8fb15d] font-bold uppercase text-xs tracking-wider mb-2">
                Teléfono de contacto *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold">🇨🇴 +57</span>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="300 000 0000"
                  className="w-full pl-24 pr-4 py-4 bg-[#0f172a] border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-[#8fb15d] transition-colors"
                />
              </div>
              <p className="text-gray-400 text-xs mt-2">Usa tu número de WhatsApp.</p>
            </div>

            {/* Plan */}
            <div>
              <label className="block text-[#8fb15d] font-bold uppercase text-xs tracking-wider mb-2">
                ¿Qué experiencia buscas? *
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-4 py-4 bg-[#0f172a] border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-[#8fb15d] transition-colors appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238fb15d' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1rem center',
                  backgroundSize: '1.25rem'
                }}
              >
                <option value="">Selecciona un plan turístico</option>
                {planes.map(plan => (
                  <option key={plan.id_plan} value={plan.id_plan}>
                    {plan.nombre_plan}
                  </option>
                ))}
              </select>
            </div>

            {/* Política de datos */}
            <div className="text-gray-400 text-xs leading-relaxed">
              <p>Autorizo el tratamiento de mis datos personales de acuerdo con la política de datos de la empresa.</p>
            </div>

            {/* Checkbox de aceptación */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="accept"
                required
                className="mt-1 w-4 h-4 text-[#8fb15d] rounded"
              />
              <label htmlFor="accept" className="text-white text-sm font-semibold">
                He leído y acepto la política de tratamiento de datos.
              </label>
            </div>

            {/* Botón continuar */}
            <button
              type="submit"
              className="w-full py-4 bg-[#8fb15d] text-white font-bold text-lg rounded-full uppercase tracking-wider hover:bg-[#7aa04d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
