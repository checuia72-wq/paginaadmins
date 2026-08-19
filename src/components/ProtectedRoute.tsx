import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Props = {
  children: React.ReactNode;
};

function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setIsAuth(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setIsAuth(false);
        setLoading(false);
        return;
      }

      if (data.session.user && !data.session.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setIsAuth(false);
      } else {
        setIsAuth(true);
      }

      setLoading(false);
    };

    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <p className="text-sm text-slate-600">Cargando…</p>
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;