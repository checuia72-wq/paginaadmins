import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const DEMO_SESSION_KEY = "forigua:demo_session";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        setError("Supabase no está configurado.");
        return;
      }

      const { data, error: supabaseError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (supabaseError) {
        setError("Credenciales incorrectas.");
        return;
      }

      if (data.session) {
        localStorage.setItem(
          DEMO_SESSION_KEY,
          JSON.stringify({ email })
        );

        window.location.href = "/app/reservas";
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">
          ¡Bienvenido!
        </h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-md border px-3 py-2"
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-white"
        >
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
        <button
  type="button"
  onClick={() => {
    localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({ email: "guest@demo.local" })
    );
    window.location.href = "/app/reservas";
  }}
  className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
>
  Entrar como invitado
</button>
      </form>
    </main>
  );
}

export default Login;