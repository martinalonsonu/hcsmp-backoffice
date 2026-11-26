import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { LoginForm } from "@/components/auth/login-form";

function LoginScreen() {
  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] lg:grid-cols-[1.08fr_0.92fr] lg:grid-rows-1">
      <section
        aria-label="Hermandad de Cargadores de San Martín de Porres"
        className="relative flex aspect-[2048/1365] w-full flex-col justify-between overflow-hidden bg-forest px-6 py-4 text-white sm:px-10 lg:aspect-auto lg:min-h-screen lg:px-14 lg:py-12"
      >
        <Image
          src="/bg-bo.jpg"
          alt="San Martín de Porres en el claustro"
          fill
          priority
          sizes="(min-width: 1024px) 54vw, 100vw"
          className="object-contain object-center opacity-55 lg:object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/20"
        />
        <HcsmpBrand inverse className="relative z-10" />
        <div className="relative z-10 mt-3 max-w-2xl lg:mt-0 lg:pb-8">
          <p className="mb-4 hidden text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[#dfd0aa] lg:block">
            ¡Somos parte de tu historia de amor!
          </p>
          <h1 className="max-w-xl font-display text-xl leading-tight tracking-[-0.035em] sm:text-2xl lg:text-5xl">
            Portal de Gestión Interna
          </h1>
          <p className="mt-5 hidden max-w-lg text-base leading-7 text-white/80 lg:block">
            Un espacio para acompañar el camino de nuestra institución.
          </p>
        </div>
      </section>

      <section className="flex min-h-0 items-center justify-center px-6 py-6 sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
        <div className="w-full max-w-md">
          <p className="eyebrow">Acceso para hermanos</p>
          <h2 className="mt-2 font-display text-3xl leading-tight tracking-[-0.035em] sm:mt-3 sm:text-4xl">
            Bienvenido de vuelta
          </h2>
          <p className="mt-3 hidden text-sm leading-6 text-muted sm:block">
            Ingresa tus datos para continuar al portal interno.
          </p>

          <LoginForm />

          <p className="mt-5 flex items-start gap-2.5 border-t border-line pt-4 text-xs leading-5 text-muted sm:mt-7 sm:pt-5">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-clay-text"
            />
            <span className="sm:hidden">
              ¿Necesitas ayuda? Comunícate con la junta directiva.
            </span>
            <span className="hidden sm:inline">
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
