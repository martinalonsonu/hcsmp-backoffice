"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/components/portal/portal-provider";

function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const { login, ready, error } = usePortal();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (failure) {
      setMessage(
        failure instanceof Error
          ? failure.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink" htmlFor="username">
          Usuario o correo electrónico
        </label>
        <Input
          autoComplete="username"
          id="username"
          name="username"
          placeholder="Usuario asignado por Secretaría"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          type="text"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <Input
            autoComplete="current-password"
            className="pr-12"
            id="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Ingresa tu contraseña"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>
      {(message || error) && (
        <p role="alert" className="text-sm text-red-700">
          {message || error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={pending || !ready}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
      <fieldset className="rounded-sm border border-line bg-white/60 p-4">
        <legend className="px-1 text-xs font-semibold text-clay-text">
          Probar un perfil
        </legend>
        <p className="mb-3 text-xs leading-5 text-muted">
          Demostración sin backend. Contraseña de las cuentas de ejemplo:{" "}
          <span className="font-mono text-ink">Demo2026!</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["secretaria", "Secretaría"],
              ["tesoreria", "Tesorería"],
              ["presidencia", "Presidencia"],
              ["hermano", "Estándar"],
            ] as const
          ).map(([user, label]) => (
            <Button
              type="button"
              key={user}
              variant="outline"
              size="sm"
              disabled={pending || !ready}
              onClick={() => {
                setUsername(user);
                setPassword("Demo2026!");
                setMessage("");
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Los hermanos nuevos ingresan con las credenciales generadas al
          registrar su ficha. Usa únicamente datos de prueba.
        </p>
      </fieldset>
    </form>
  );
}

export { LoginForm };
