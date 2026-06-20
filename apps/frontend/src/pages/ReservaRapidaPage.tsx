import React, { useState, useEffect } from 'react';
import { getPlanes, getClientes, createCliente, updateCliente, createReserva } from '../services/api.service';
import { 
  Calendar, 
  MessageCircle, 
  Compass, 
  ShieldCheck, 
  Sparkles,
  CheckSquare
} from 'lucide-react';

const ReservaRapidaPage = () => {
  const [telefono, setTelefono] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [planes, setPlanes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

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

    if (!telefono || !selectedPlan || !acceptTerms) {
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
      setAcceptTerms(false);

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Ocurrió un error al procesar la reserva');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(/fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="w-full max-w-3xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#f8f3e9] rounded-full mb-4 relative">
            <Calendar className="w-8 h-8 text-[#4a6733]" />
            <Sparkles className="w-4 h-4 text-[#c9a84a] absolute -top-1 -left-1" />
            <Sparkles className="w-4 h-4 text-[#c9a84a] absolute -top-1 -right-1" />
          </div>
          <h1 className="text-4xl font-bold text-[#2d2d2b] mb-3" style={{ fontFamily: 'Georgia, serif' }}>
            Reserva rápida
          </h1>
          <p className="text-[#6b665e] text-base">
            Completa tu información y elige una experiencia para comenzar
          </p>
          <div className="mt-4 flex justify-center">
            <svg width="80" height="20" viewBox="0 0 80 20" className="text-[#c9a84a]">
              <path
                d="M0,10 Q10,0 20,10 T40,10 T60,10 T80,10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 relative">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
              ✅ Reserva creada exitosamente
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phone Field */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#f0f4ec] rounded-full flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-[#4a6733]" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-[#2d2d2b] mb-2">
                  Teléfono de contacto <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3 bg-white border border-[#d1d0cd] rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#f9f8f6] border-r border-[#d1d0cd]">
                    <span className="text-lg">🇨🇴</span>
                    <span className="text-[#6b665e]">+57</span>
                  </div>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="300 000 0000"
                    className="flex-1 px-4 py-3 text-[#2d2d2b] placeholder-[#a19e97] focus:outline-none"
                  />
                </div>
                <p className="text-xs text-[#6b665e] mt-2">
                  Usa tu mismo número de WhatsApp para recibir confirmaciones.
                </p>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#f0f4ec] rounded-full flex items-center justify-center">
                  <Compass className="w-7 h-7 text-[#4a6733]" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-[#2d2d2b] mb-2">
                  ¿Qué experiencia buscas? <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#d1d0cd] rounded-lg text-[#2d2d2b] focus:outline-none focus:border-[#4a6733] appearance-none cursor-pointer"
                  >
                    <option value="">Selecciona un plan turístico</option>
                    {loading ? (
                      <option disabled>Cargando planes...</option>
                    ) : planes.length === 0 ? (
                      <option disabled>No hay planes disponibles</option>
                    ) : (
                      planes.map(plan => (
                        <option key={plan.id_plan} value={plan.id_plan}>
                          {plan.nombre_plan}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-[#4a6733]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="bg-[#f0f3ee] rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-[#4a6733] bg-opacity-10 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#4a6733]" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[#4a4a48] mb-3">
                    Autorizo el tratamiento de mis datos personales de acuerdo con la política de privacidad de la empresa y la Ley 1581 de 2012.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 border-2 border-[#d1d0cd] rounded peer-checked:border-[#4a6733] peer-checked:bg-[#4a6733] transition-all flex items-center justify-center">
                        <CheckSquare className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
                      </div>
                    </div>
                    <span className="text-sm text-[#4a4a48]">
                      He leído y acepto el tratamiento de datos personales.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={!telefono || !selectedPlan || !acceptTerms}
                className="w-full py-4 bg-[#4a6733] text-white font-bold text-lg rounded-xl flex items-center justify-center gap-3 hover:bg-[#3a5429] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5 opacity-70" />
                <Calendar className="w-5 h-5" />
                <span>Confirmar reserva</span>
                <Sparkles className="w-5 h-5 opacity-70" />
              </button>
            </div>
          </form>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-[#8b867d] text-sm">
            <ShieldCheck className="w-4 h-4 text-[#c9a84a]" />
            <span>Tu información está segura con nosotros</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservaRapidaPage;
