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
      className="min-h-screen bg-cover bg-center bg-no-repeat px-4 py-10"
      style={{ backgroundImage: "url('/fondo.png')" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl flex-col items-center justify-center">
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#f8efe0]/90 shadow-sm">
            <Calendar className="h-9 w-9 text-[#b9843c]" />
            <Sparkles className="absolute -left-2 top-2 h-4 w-4 text-[#d8a654]" />
            <Sparkles className="absolute -right-2 top-2 h-4 w-4 text-[#d8a654]" />
          </div>

          <h1
            className="text-5xl font-bold text-[#213b24]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Reserva rápida
          </h1>

          <p className="mt-3 text-base text-[#6f665c]">
            Completa tu información y elige una experiencia para comenzar
          </p>

          <div className="mt-4 text-[#d3a04c]">━━━━</div>
        </div>

        <div className="w-full max-w-3xl rounded-[28px] bg-white/95 p-8 shadow-2xl backdrop-blur-md">
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

          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="grid gap-5 md:grid-cols-[74px_1fr]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf3e4]">
                <MessageCircle className="h-8 w-8 text-[#2f6b38]" />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-[#25211c]">
                  Teléfono de contacto <span className="text-red-500">*</span>
                </label>

                <div className="flex overflow-hidden rounded-xl border border-[#ded8cf] bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-r border-[#ded8cf] bg-[#faf6ef] px-4">
                    <span>🇨🇴</span>
                    <span className="font-medium text-[#3f3a34]">+57</span>
                  </div>

                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="300 000 0000"
                    className="w-full px-4 py-4 text-[#2b2722] outline-none placeholder:text-[#aaa29a]"
                  />
                </div>

                <p className="mt-2 text-sm text-[#7d746b]">
                  Usa el mismo número de WhatsApp para recibir confirmaciones.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[74px_1fr]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf3e4]">
                <Compass className="h-8 w-8 text-[#2f6b38]" />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-[#25211c]">
                  ¿Qué experiencia buscas?{" "}
                  <span className="text-red-500">*</span>
                </label>

                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-[#ded8cf] bg-white px-4 py-4 text-[#2b2722] shadow-sm outline-none transition focus:border-[#2f6b38] focus:ring-2 focus:ring-[#2f6b38]/20"
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
              </div>
            </div>

            <div className="rounded-2xl bg-[#f2f5ef] p-5">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dfeadb]">
                  <ShieldCheck className="h-6 w-6 text-[#2f6b38]" />
                </div>

                <div>
                  <p className="text-sm leading-relaxed text-[#403b35]">
                    Autorizo el tratamiento de mis datos personales de acuerdo
                    con la política de privacidad de la empresa y la Ley 1581 de
                    2012.
                  </p>

                  <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-[#403b35]">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="h-5 w-5 accent-[#2f6b38]"
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
                className="flex w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-[#2f6b38] px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-[#285d30] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Calendar className="h-5 w-5" />
                Confirmar reserva
              </button>
            </div>
          </form>
        </div>

        <div className="mt-7 flex items-center gap-2 text-sm font-medium text-[#746b62]">
          <ShieldCheck className="h-4 w-4 text-[#c79546]" />
          Tu información está segura con nosotros
        </div>
      </div>
    </div>
  );
};

export default ReservaRapidaPage;