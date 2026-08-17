import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  CheckCircle2,
  Loader2,
  LogIn,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "wouter";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/Prodigio-Logo-500_f9858498.png";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  pmo: "PMO",
  pm: "Project Manager",
  consulta: "Consulta",
};

export default function InviteAccept() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [accepted, setAccepted] = useState(false);
  const [acceptedData, setAcceptedData] = useState<{ name: string; email: string; role: string } | null>(null);

  const { data: invite, isLoading, error } = trpc.users.getInvite.useQuery(
    { token: token ?? "" },
    { enabled: !!token && !accepted }
  );

  const acceptMutation = trpc.users.acceptInvite.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      setAcceptedData(data);
    },
  });

  // Auto-accept when invitation is loaded
  useEffect(() => {
    if (invite && !accepted && !acceptMutation.isPending) {
      acceptMutation.mutate({ token: token ?? "" });
    }
  }, [invite]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Prodigio Tech" className="h-20 w-20 object-contain mx-auto rounded-full shadow-lg" />
          <h1 className="text-white text-2xl font-bold mt-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Prodigio
          </h1>
          <p className="text-white/50 text-sm mt-1">Prodigio Tech</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {isLoading || (invite && !accepted && !acceptMutation.isError) ? (
            <div className="p-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="font-semibold text-gray-800">Verificando invitación...</p>
              <p className="text-sm text-gray-500 mt-1">Por favor espera un momento</p>
            </div>
          ) : error || acceptMutation.isError ? (
            <div className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Invitación no válida</h2>
              <p className="text-gray-500 text-sm mb-6">
                {(error as any)?.message ?? (acceptMutation.error as any)?.message ?? "Esta invitación no existe, ya fue utilizada o ha expirado."}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = "/"}
              >
                Ir al inicio
              </Button>
            </div>
          ) : accepted && acceptedData ? (
            <div className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                ¡Bienvenido/a, {acceptedData.name}!
              </h2>
              <p className="text-gray-500 text-sm mb-2">
                Tu invitación ha sido aceptada exitosamente.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                Rol asignado: {ROLE_LABELS[acceptedData.role] ?? acceptedData.role}
              </div>
              <div className="rounded-lg p-4 bg-gray-50 border text-left mb-6">
                <p className="text-xs text-gray-500 mb-1">Correo de acceso</p>
                <p className="text-sm font-semibold text-gray-800">{acceptedData.email}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Usa este correo para iniciar sesión con el SSO de Prodigio Tech.
                </p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => { window.location.href = getLoginUrl(); }}
              >
                <LogIn className="h-4 w-4" />
                Iniciar Sesión en la Plataforma
              </Button>
            </div>
          ) : null}
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} Prodigio Tech · Prodigio
        </p>
      </div>
    </div>
  );
}
