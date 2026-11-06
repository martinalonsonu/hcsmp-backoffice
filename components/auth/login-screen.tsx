import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { LoginForm } from "@/components/auth/login-form";

function LoginScreen() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section
        aria-label="Hermandad de Cargadores de San Martín de Porres"
        className="relative flex min-h-88 flex-col justify-between overflow-hidden bg-forest px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 lg:py-12"
      >
        <Image
          src="/bg-bo.jpg"
          alt="San Martín de Porres en el claustro"
          fill
          priority
          sizes="(min-width: 1024px) 54vw, 100vw"
          className="object-cover object-center opacity-55"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/20"
        />
        <HcsmpBrand inverse className="relative z-10" />
        <div className="relative z-10 max-w-2xl pb-2 lg:pb-8">
          <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[#dfd0aa]">
            ¡Somos parte de tu historia de amor!
          </p>
          <h1 className="max-w-xl font-display text-3xl leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Portal de Gestión Interna
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/80 sm:text-base">
            Un espacio para acompañar el camino de nuestra institución.
          </p>
        </div>
      </section>

      <section className="flex min-h-136 items-center justify-center px-6 py-12 sm:px-10 lg:min-h-screen lg:px-14">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <HcsmpBrand />
          </div>
          <p className="eyebrow">Acceso para hermanos</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">
            Bienvenido de vuelta
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Ingresa tus datos para continuar al portal interno.
          </p>

          <LoginForm />

          <p className="mt-7 flex items-start gap-2.5 border-t border-line pt-5 text-xs leading-5 text-muted">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-clay-text"
            />
            <span>
              El acceso es gestionado por la Hermandad. Si no puedes ingresar o
              necesitas ayuda, comunícate con la junta directiva.
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}

export { LoginScreen };
