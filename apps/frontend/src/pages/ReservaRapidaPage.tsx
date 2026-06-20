import React, { useEffect, useState } from "react";
import {
  getPlanes,
  getClientes,
  createCliente,
  updateCliente,
  createReserva,
} from "../services/api.service";
import {
  Calendar,
  MessageCircle,
  Compass,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const ReservaRapidaPage = () => {
  const [telefono, setTelefono] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [planes, setPlanes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [planesData, clientesData] = await Promise.all([
          getPlanes(),
          getClientes(),
        ]);

        setPlanes(planesData);
        setClientes(clientesData);
      } catch (err) {
        console.error("Error al cargar datos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!telefono || !selectedPlan || !acceptTerms) {
      setError("Por favor completa todos los campos.");
      return;
    }

    try {
      const clienteExistente = clientes.find((c) => c.telefono === telefono);

      if (clienteExistente) {
        await updateCliente(telefono, {
          atencion_humana: true,
          id_plan: parseInt(selectedPlan),
        });
      } else {
        await createCliente({
          telefono,
          atencion_humana: true,
          id_plan: parseInt(selectedPlan),
          etapaconversacion: "saludo",
        });
      }

      await createReserva({
        telefono_cliente: telefono,
        id_plan: parseInt(selectedPlan),
        cantidad_personas: 1,
        aprobado: false,
      });

      setSuccess(true);
      setTelefono("");
      setSelectedPlan("");
      setAcceptTerms(false);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "Ocurrió un error al procesar la reserva.");
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat p-4"
      style={{ 
        backgroundImage: "url('/fondo.png')",
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-4xl flex-col items-center justify-center">
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f8efe0]/90 shadow-sm">
            <Calendar className="h-8 w-8 text-[#b9843c]" />
            <Sparkles className="absolute -left-1 -top-1 h-4 w-4 text-[#d8a654]" />
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#d8a654]" />
          </div>

          <h1
            className="text-3xl md:text-4xl font-bold text-[#213b24]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Reserva rápida
          </h1>

          <p className="mt-3 text-sm md:text-base text-[#6f665c]">
            Completa tu información y elige una experiencia para comenzar
          </p>

          <div className="mt-4 flex justify-center">
            <svg width="80" height="12" viewBox="0 0 80 12" className="text-[#d3a04c]">
              <path
                d="M0,6 Q10,0 20,6 T40,6 T60,6 T80,6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <div className="w-full max-w-2xl rounded-2xl bg-white/95 p-6 md:p-8 shadow-xl backdrop-blur-sm">
          {success && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center text-green-700">
              ✅ Reserva creada exitosamente.
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-700">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf3e4] shrink-0">
                <MessageCircle className="h-7 w-7 text-[#2f6b38]" />
              </div>

              <div className="flex-1 w-full">
                <label className="mb-2 block text-sm font-semibold text-[#25211c]">
                  Teléfono de contacto <span className="text-red-500">*</span>
                </label>

                <div className="flex overflow-hidden rounded-xl border border-[#ded8cf] bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-r border-[#ded8cf] bg-[#faf6ef] px-4 py-3">
                    <span>🇨🇴</span>
                    <span className="text-sm font-medium text-[#3f3a34]">+57</span>
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={telefono}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/\D/g, '');
                      setTelefono(value);
                    }}
                    placeholder="300 000 0000"
                    maxLength={10}
                    className="flex-1 px-4 py-3 text-[#2b2722] outline-none placeholder:text-[#aaa29a] text-base"
                  />
                </div>

                <p className="mt-2 text-xs text-[#7d746b]">
                  Usa el mismo número de WhatsApp para recibir confirmaciones.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf3e4] shrink-0">
                <Compass className="h-7 w-7 text-[#2f6b38]" />
              </div>

              <div className="flex-1 w-full">
                <label className="mb-2 block text-sm font-semibold text-[#25211c]">
                  ¿Qué experiencia buscas?{" "}
                  <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-[#ded8cf] bg-white px-4 py-3 text-[#2b2722] shadow-sm outline-none transition focus:border-[#2f6b38] focus:ring-2 focus:ring-[#2f6b38]/20 appearance-none text-base"
                  >
                    <option value="">Selecciona un plan turístico</option>

                    {loading ? (
                      <option disabled>Cargando planes...</option>
                    ) : planes.length === 0 ? (
                      <option disabled>No hay planes disponibles</option>
                    ) : (
                      planes.map((plan) => (
                        <option key={plan.id_plan} value={plan.id_plan}>
                          {plan.nombre_plan}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-[#2f6b38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#f2f5ef] p-4 md:p-5">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dfeadb]">
                  <ShieldCheck className="h-5 w-5 text-[#2f6b38]" />
                </div>

                <div>
                  <p className="text-xs md:text-sm leading-relaxed text-[#403b35]">
                    Autorizo el tratamiento de mis datos personales de acuerdo
                    con la política de privacidad de la empresa y la Ley 1581 de
                    2012.
                  </p>

                  <label className="mt-3 flex cursor-pointer items-center gap-3 text-xs md:text-sm text-[#403b35]">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="h-4 w-4 accent-[#2f6b38]"
                    />
                    He leído y acepto el tratamiento de datos personales.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={!telefono || !selectedPlan || !acceptTerms}
                className="flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-[#2f6b38] px-8 py-3 md:py-4 text-base md:text-lg font-bold text-white shadow-md transition hover:bg-[#285d30] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 opacity-70" />
                <Calendar className="h-5 w-5" />
                Confirmar reserva
                <Sparkles className="h-4 w-4 opacity-70" />
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs md:text-sm font-medium text-[#746b62]">
          <ShieldCheck className="h-4 w-4 text-[#c79546]" />
          Tu información está segura con nosotros
        </div>
      </div>
    </div>
  );
};

export default ReservaRapidaPage;