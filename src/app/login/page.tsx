import Link from "next/link";
import { signIn } from "@/auth";
import Logo from "@/app/components/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="h-16 w-16" />
        <h1 className="mt-4 text-3xl font-bold text-gray-900">MFL Platform</h1>
        <p className="mt-1 text-gray-500">Multifunctional Landscapes</p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Iniciar Sesión</h2>
        <p className="mt-1 text-sm text-gray-500">
          Accede con tu cuenta institucional. Te llevaremos al inicio de sesión seguro.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("keycloak", { redirectTo: callbackUrl || "/dashboard" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
          >
            Iniciar Sesión
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          El registro, la verificación de correo y la recuperación de contraseña se gestionan en la
          pantalla de acceso.
        </p>
      </div>

      <Link href="/" className="mt-6 text-sm text-gray-500 hover:text-gray-700">
        ← Volver al inicio
      </Link>
    </div>
  );
}
