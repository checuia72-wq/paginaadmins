import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  children: React.ReactNode;
};

function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuth(!!session);
      setLoading(false);
    };

    checkSession();
  }, []);

  if (loading) {
    return <p>Cargando...</p>;
  }

  if (!isAuth) {
    window.location.href = "/";
    return null;
  }

  return <>{children}</>;
}

export default ProtectedRoute;