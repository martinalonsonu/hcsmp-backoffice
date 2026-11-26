"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithEmail } from "@/lib/firebase/auth";
import { finishRegistration, sendRegistrationLink } from "@/lib/firebase/registration";

const subscribeLocation = () => () => {};
const registrationLinkSnapshot = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "signIn" && params.has("oobCode");
};
const serverRegistrationLinkSnapshot = () => false;

function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [screen, setScreen] = useState<"login" | "request">("login");
  const isRegistration = useSyncExternalStore(subscribeLocation, registrationLinkSnapshot, serverRegistrationLinkSnapshot);
  const mode = isRegistration ? "finish" : screen;
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setNotice("");
    try {
      if (mode === "request") {
        await sendRegistrationLink(email);
        setNotice("Revisa tu correo y abre el enlace para completar tu registro.");
      } else {
        if (mode === "finish") await finishRegistration(email, password);
        else await loginWithEmail(email, password);
        router.replace("/dashboard");
      }
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
    <form className="mt-5 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink" htmlFor="email">
          Correo electrónico
        </label>
        <Input
          autoComplete="username"
          id="email"
          name="email"
          placeholder="Correo registrado por Secretaría"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
        />
      </div>
      {mode !== "request" && <div className="space-y-2">
        <label className="text-sm font-medium text-ink" htmlFor="password">
          {mode === "finish" ? "Crea tu contraseña" : "Contraseña"}
        </label>
        <div className="relative">
          <Input
            autoComplete={mode === "finish" ? "new-password" : "current-password"}
            className="pr-12"
            id="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Ingresa tu contraseña"
            required
            minLength={mode === "finish" ? 6 : undefined}
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
      </div>}
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
      {notice && <p role="status" className="text-sm text-forest">{notice}</p>}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Procesando…" : mode === "request" ? "Enviar enlace" : mode === "finish" ? "Completar registro" : "Iniciar sesión"}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
      {mode !== "finish" && <button type="button" className="text-sm text-clay-text underline"
        disabled={pending} onClick={() => { setScreen(mode === "login" ? "request" : "login"); setMessage(""); setNotice(""); }}>
        {mode === "login" ? "Activar mi cuenta" : "Volver al inicio de sesión"}
      </button>}
      {mode !== "login" && <p className="text-xs leading-5 text-muted">
        Para activar tu cuenta, usa el correo registrado por Secretaría.
      </p>}
    </form>
  );
}

export { LoginForm };
