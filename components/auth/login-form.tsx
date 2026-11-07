"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithUsername } from "@/lib/firebase/auth";

function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      await loginWithUsername(username, password);
      router.replace("/dashboard");
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
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
      <p className="text-xs leading-5 text-muted">
        Acceso institucional mediante Firebase. Las cuentas de demostración
        ya no están disponibles en este formulario.
      </p>
    </form>
  );
}

export { LoginForm };
