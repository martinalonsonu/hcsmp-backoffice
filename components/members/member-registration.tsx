"use client";

import Image from "next/image";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/components/portal/portal-provider";
import {
  ageOnDate,
  categoryLabels,
  emptyMemberDraft,
  todayDate,
  validateMember,
  type Guardian,
  type MemberDraft,
} from "@/lib/portal";
import { cn } from "@/lib/utils";

type Step = "personal" | "contact" | "guardian" | "institution" | "review";
type Errors = Record<string, string>;
const titles: Record<Step, string> = {
  personal: "Datos personales",
  contact: "Información complementaria",
  guardian: "Apoderado",
  institution: "Datos institucionales",
  review: "Acceso y revisión",
};
const sacraments = [
  "Bautizo",
  "Primera comunión",
  "Confirmación",
  "Matrimonio",
];
const selectClass =
  "h-12 w-full rounded-sm border border-line bg-white-warm px-3 text-sm focus-visible:outline-clay disabled:opacity-50";

function newGuardian(): Guardian {
  return {
    fullName: "",
    dni: "",
    education: "",
    address: "",
    phone: "",
    relationship: "",
    age: "",
    sacraments: [],
  };
}

function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted">{hint}</p>}
      {error && (
        <p className="text-xs text-red-700" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function Sacraments({
  value,
  onChange,
  guardian = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  guardian?: boolean;
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-3 text-sm font-medium">
        Sacramentos recibidos
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {sacraments.slice(0, guardian ? 3 : 4).map((name) => (
          <label
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-line bg-white p-3 text-sm"
            key={name}
          >
            <input
              className="size-4 accent-clay"
              type="checkbox"
              checked={value.includes(name)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, name]
                    : value.filter((item) => item !== name),
                )
              }
            />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line/70 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">
        {value || "Sin registrar"}
      </dd>
    </div>
  );
}

function MemberRegistration({ onClose }: { onClose: () => void }) {
  const { currentMember, members, createMember } = usePortal();
  const [draft, setDraft] = useState<MemberDraft>(emptyMemberDraft);
  const [step, setStep] = useState<Step>("personal");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const closeTriggerRef = useRef<HTMLElement | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const age = ageOnDate(draft.birthDate);
  const hasBirthDate =
    draft.birthDate !== "" && age !== null && Number.isFinite(age);
  const isMinor = hasBirthDate && age < 18;
  const steps: Step[] = [
    "personal",
    "contact",
    ...(isMinor ? ["guardian" as Step] : []),
    "institution",
    "review",
  ];
  const stepIndex = steps.indexOf(step);

  useEffect(() => {
    if (currentMember?.role !== "secretaria") return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [currentMember?.role]);

  useEffect(() => {
    if (confirmClose) continueRef.current?.focus();
  }, [confirmClose]);

  function update<K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) {
    dirtyRef.current = true;
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "birthDate") {
        const nextAge = ageOnDate(String(value));
        if (nextAge !== null && nextAge < 18) {
          next.category = "postulante";
          next.guardian ??= newGuardian();
        }
      }
      return next;
    });
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  function updateGuardian<K extends keyof Guardian>(
    key: K,
    value: Guardian[K],
  ) {
    dirtyRef.current = true;
    setDraft((previous) => ({
      ...previous,
      guardian: { ...(previous.guardian ?? newGuardian()), [key]: value },
    }));
    setErrors((previous) => ({ ...previous, [`guardian.${key}`]: "" }));
    setMessage("");
  }

  function requestClose() {
    if (savingRef.current || readingPhoto) return;
    if (credentials || !dirtyRef.current) onClose();
    else {
      if (!confirmClose)
        closeTriggerRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      setConfirmClose(true);
    }
  }

  function continueRegistration() {
    setConfirmClose(false);
    requestAnimationFrame(() => closeTriggerRef.current?.focus());
  }

  function showErrors(next: Errors) {
    setErrors(next);
    requestAnimationFrame(() => {
      const firstKey = Object.keys(next)[0];
      const field = document.getElementById(`registration-${firstKey}`);
      if (field) field.focus();
      else titleRef.current?.focus();
    });
  }

  function validateStep(): boolean {
    const next: Errors = {};
    const all = validateMember(
      { ...draft, guardian: isMinor ? draft.guardian : null },
      members,
    );
    const keys: Record<Step, string[]> = {
      personal: ["fullName", "dni", "birthDate", "photo"],
      contact: [
        "email",
        "phone",
        "address",
        "occupation",
        "maritalStatus",
        "sacraments",
      ],
      guardian: [
        "guardian",
        "guardian.fullName",
        "guardian.dni",
        "guardian.age",
        "guardian.phone",
        "guardian.relationship",
        "guardian.address",
        "guardian.education",
      ],
      institution: ["joinedAt", "swornAt", "category"],
      review: Object.keys(all),
    };
    for (const key of keys[step]) if (all[key]) next[key] = all[key];
    if (step === "personal") {
      if (!draft.fullName.trim())
        next.fullName = "Ingresa los nombres y apellidos.";
      if (!/^\d{8}$/.test(draft.dni)) next.dni = "El DNI debe tener 8 dígitos.";
      if (
        !draft.birthDate ||
        age === null ||
        !Number.isFinite(age) ||
        age < 0 ||
        draft.birthDate > todayDate()
      )
        next.birthDate = "Ingresa una fecha de nacimiento válida.";
    }
    if (step === "guardian") {
      const guardian = draft.guardian;
      if (!guardian?.fullName.trim())
        next["guardian.fullName"] = "Ingresa el nombre del apoderado.";
      if (!/^\d{8}$/.test(guardian?.dni ?? ""))
        next["guardian.dni"] = "El DNI debe tener 8 dígitos.";
      if (!guardian?.relationship.trim())
        next["guardian.relationship"] = "Indica el parentesco.";
    }
    if (Object.keys(next).length) {
      showErrors(next);
      return false;
    }
    setErrors({});
    return true;
  }

  function goTo(next: Step) {
    setStep(next);
    setErrors({});
    setMessage("");
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      dialogRef.current
        ?.querySelector("[data-scroll-content]")
        ?.scrollTo({ top: 0 });
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || readingPhoto) return;
    setConfirmClose(false);
    if (!validateStep()) return;
    if (step !== "review") {
      goTo(steps[stepIndex + 1]);
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      const result = await createMember({
        ...draft,
        guardian: isMinor ? draft.guardian : null,
      });
      setCredentials({ username: result.username, password: result.password });
      dirtyRef.current = false;
      requestAnimationFrame(() => titleRef.current?.focus());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar. Revisa los datos e inténtalo de nuevo.",
      );
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setErrors((previous) => ({
        ...previous,
        photo: "Selecciona una imagen JPG, PNG o WebP de hasta 1 MB.",
      }));
      event.target.value = "";
      return;
    }
    setReadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      update("photo", String(reader.result));
      setReadingPhoto(false);
    };
    reader.onerror = () => {
      setErrors((previous) => ({
        ...previous,
        photo: "No se pudo leer la imagen.",
      }));
      setReadingPhoto(false);
    };
    reader.readAsDataURL(file);
  }

  async function copyCredentials() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(
        `Portal HCSMP\nUsuario: ${credentials.username}\nContraseña inicial: ${credentials.password}`,
      );
      setCopied(true);
      setMessage("");
    } catch {
      setMessage(
        "No se pudo copiar automáticamente. Puedes seleccionar y copiar las credenciales que aparecen arriba.",
      );
    }
  }

  function input(
    key: keyof MemberDraft,
    label: string,
    props: ComponentProps<"input"> = {},
    hint?: string,
  ) {
    const id = `registration-${key}`;
    return (
      <Field id={id} label={label} error={errors[key]} hint={hint}>
        <Input
          {...props}
          id={id}
          value={String(draft[key] ?? "")}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : undefined}
          onChange={(event) => update(key, event.target.value as never)}
        />
      </Field>
    );
  }

  function guardianInput(
    key: keyof Guardian,
    label: string,
    props: ComponentProps<"input"> = {},
  ) {
    const id = `registration-guardian.${key}`;
    return (
      <Field id={id} label={label} error={errors[`guardian.${key}`]}>
        <Input
          {...props}
          id={id}
          value={String(draft.guardian?.[key] ?? "")}
          aria-invalid={Boolean(errors[`guardian.${key}`])}
          aria-describedby={
            errors[`guardian.${key}`] ? `${id}-error` : undefined
          }
          onChange={(event) => updateGuardian(key, event.target.value as never)}
        />
      </Field>
    );
  }

  if (currentMember?.role !== "secretaria") return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="registration-title"
      aria-describedby="registration-description"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-paper p-0 text-ink backdrop:bg-ink/50"
    >
      <form
        className="flex h-full min-h-0 flex-col"
        noValidate
        onSubmit={submit}
      >
        <header className="shrink-0 border-b border-line bg-white-warm px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Secretaría · Padrón de hermanos</p>
              <h2
                className="mt-2 font-display text-2xl sm:text-3xl"
                id="registration-title"
                ref={titleRef}
                tabIndex={-1}
              >
                {credentials ? "Hermano registrado" : "Nuevo hermano"}
              </h2>
              <p
                className="mt-2 text-sm text-muted"
                id="registration-description"
              >
                {credentials
                  ? "La ficha y su acceso al portal se crearon correctamente."
                  : "Completa la ficha y crea su acceso al portal en un solo registro."}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={busy || readingPhoto}
              aria-label="Cerrar registro"
              onClick={requestClose}
            >
              <X className="size-5" />
            </Button>
          </div>
        </header>

        {confirmClose && (
          <div
            className="shrink-0 border-b border-clay bg-mist px-4 py-3"
            role="alert"
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                La ficha aún no está guardada. ¿Deseas salir y descartar lo
                ingresado?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  ref={continueRef}
                  onClick={continueRegistration}
                >
                  Continuar registro
                </Button>
                <Button size="sm" type="button" onClick={onClose}>
                  Descartar y salir
                </Button>
              </div>
            </div>
          </div>
        )}

        {!credentials && (
          <nav
            aria-label="Pasos del registro"
            className="shrink-0 overflow-x-auto border-b border-line bg-white-warm px-4 py-4 sm:px-8"
          >
            <ol className="mx-auto flex max-w-5xl items-start gap-4 sm:gap-6">
              {steps.map((item, index) => (
                <li
                  key={item}
                  aria-current={step === item ? "step" : undefined}
                  className={cn(
                    "flex min-w-24 flex-1 items-center gap-2 text-xs sm:text-sm",
                    index > stepIndex && "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                      index <= stepIndex
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-paper",
                    )}
                  >
                    {index < stepIndex ? (
                      <Check className="size-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={cn(step === item && "font-semibold")}>
                    {titles[item]}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-9"
          data-scroll-content
        >
          <div className="mx-auto max-w-4xl">
            {credentials ? (
              <div className="mx-auto max-w-xl rounded-sm border border-line bg-white-warm p-6 sm:p-8">
                <CheckCircle2 className="size-10 text-clay-text" />
                <h3 className="mt-4 font-display text-2xl">
                  El acceso ya está habilitado
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Entrega estas credenciales a {draft.fullName}. Podrá ingresar
                  con su usuario y cambiar la contraseña desde Mi perfil.
                </p>
                <div className="mt-6 space-y-4 rounded-sm border border-line bg-paper p-5">
                  <div>
                    <p className="text-xs text-muted">Usuario</p>
                    <p className="mt-1 select-all break-all font-mono text-lg font-semibold">
                      {credentials.username}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Contraseña inicial</p>
                    <p className="mt-1 select-all break-all font-mono text-lg font-semibold">
                      {credentials.password}
                    </p>
                  </div>
                  <p className="border-t border-line pt-3 text-xs text-muted">
                    Perfil de acceso: Estándar · Categoría:{" "}
                    {categoryLabels[draft.category]}
                  </p>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted">
                  La contraseña inicial se muestra al finalizar este registro.
                  Cópiala antes de cerrar.
                </p>
                <Button
                  className="mt-5 w-full"
                  type="button"
                  variant="outline"
                  onClick={copyCredentials}
                >
                  <Copy className="size-4" />
                  {copied ? "Credenciales copiadas" : "Copiar credenciales"}
                </Button>
                {copied && (
                  <p role="status" className="mt-2 text-xs text-clay-text">
                    Credenciales copiadas al portapapeles.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-clay-text">
                      Paso {stepIndex + 1} de {steps.length}
                    </p>
                    <h3 className="mt-2 font-display text-2xl">
                      {titles[step]}
                    </h3>
                  </div>
                  {hasBirthDate && (
                    <span className="rounded-full border border-line bg-mist px-3 py-2 text-xs font-medium">
                      Ficha de {isMinor ? "menor" : "mayor"} de edad · {age}{" "}
                      años
                    </span>
                  )}
                </div>
                <div className="rounded-sm border border-line bg-white-warm p-5 sm:p-7">
                  {step === "personal" && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field
                          id="registration-photo"
                          label="Foto del hermano"
                          error={errors.photo}
                          hint="Opcional. JPG, PNG o WebP, hasta 1 MB."
                        >
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-sm border border-line bg-paper">
                              {draft.photo ? (
                                <Image
                                  src={draft.photo}
                                  alt="Foto seleccionada del nuevo hermano"
                                  width={80}
                                  height={80}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <UserRound className="size-8 text-muted" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Input
                                id="registration-photo"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={uploadPhoto}
                                aria-invalid={Boolean(errors.photo)}
                                aria-describedby={
                                  errors.photo
                                    ? "registration-photo-error"
                                    : undefined
                                }
                                className="h-auto min-h-12 cursor-pointer px-3 py-2.5 file:mr-3 file:rounded-sm file:border-0 file:bg-mist file:px-2 file:py-1 file:text-xs"
                              />
                              {readingPhoto && (
                                <p
                                  className="mt-1 text-xs text-muted"
                                  role="status"
                                >
                                  Cargando imagen…
                                </p>
                              )}
                            </div>
                            {draft.photo && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => update("photo", "")}
                              >
                                Quitar foto
                              </Button>
                            )}
                          </div>
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        {input("fullName", "Nombres y apellidos *", {
                          autoComplete: "name",
                          maxLength: 150,
                          required: true,
                          autoFocus: true,
                        })}
                      </div>
                      {input("dni", "DNI *", {
                        inputMode: "numeric",
                        maxLength: 8,
                        pattern: "[0-9]{8}",
                        required: true,
                      })}
                      {input("birthDate", "Fecha de nacimiento *", {
                        type: "date",
                        max: todayDate(),
                        required: true,
                      })}
                      <p className="text-xs leading-5 text-muted sm:col-span-2">
                        La edad determina qué ficha se completa. Los menores de
                        18 años se registran como postulantes y requieren los
                        datos de un apoderado.
                      </p>
                    </div>
                  )}

                  {step === "contact" && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        {input("address", "Dirección", {
                          autoComplete: "street-address",
                          maxLength: 250,
                        })}
                      </div>
                      {input("phone", "Número de celular", {
                        type: "tel",
                        autoComplete: "tel",
                        maxLength: 20,
                      })}
                      {input(
                        "email",
                        "Correo electrónico (opcional)",
                        {
                          type: "email",
                          autoComplete: "email",
                          maxLength: 150,
                        },
                        "Podrá ingresar con su usuario aunque no tenga correo.",
                      )}
                      {input("occupation", "Profesión u ocupación", {
                        maxLength: 100,
                      })}
                      <Field
                        id="registration-maritalStatus"
                        label="Estado civil"
                      >
                        <select
                          id="registration-maritalStatus"
                          className={selectClass}
                          value={draft.maritalStatus}
                          onChange={(event) =>
                            update("maritalStatus", event.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {[
                            "Soltero/a",
                            "Casado/a",
                            "Viudo/a",
                            "Divorciado/a",
                            "Conviviente",
                          ].map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </Field>
                      <Sacraments
                        value={draft.sacraments}
                        onChange={(value) => update("sacraments", value)}
                      />
                    </div>
                  )}

                  {step === "guardian" && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <p className="rounded-sm bg-paper p-3 text-sm leading-6 text-muted sm:col-span-2">
                        Este bloque corresponde a la ficha de inscripción de
                        menores de edad.
                      </p>
                      <div className="sm:col-span-2">
                        {guardianInput(
                          "fullName",
                          "Nombres y apellidos del apoderado *",
                          {
                            autoComplete: "off",
                            maxLength: 150,
                            required: true,
                          },
                        )}
                      </div>
                      {guardianInput("dni", "DNI del apoderado *", {
                        inputMode: "numeric",
                        maxLength: 8,
                        required: true,
                      })}
                      {guardianInput("age", "Edad del apoderado", {
                        type: "number",
                        min: 0,
                      })}
                      {guardianInput(
                        "relationship",
                        "Parentesco con el menor *",
                        { maxLength: 60, required: true },
                      )}
                      {guardianInput("education", "Grado de instrucción", {
                        maxLength: 100,
                      })}
                      <div className="sm:col-span-2">
                        {guardianInput("address", "Dirección del apoderado", {
                          maxLength: 250,
                        })}
                      </div>
                      {guardianInput("phone", "Celular del apoderado *", {
                        type: "tel",
                        maxLength: 20,
                        required: true,
                      })}
                      <Sacraments
                        guardian
                        value={draft.guardian?.sacraments ?? []}
                        onChange={(value) =>
                          updateGuardian("sacraments", value)
                        }
                      />
                    </div>
                  )}

                  {step === "institution" && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      {input("joinedAt", "Fecha de ingreso a la hermandad *", {
                        type: "date",
                        max: todayDate(),
                        min: draft.birthDate || undefined,
                        required: true,
                      })}
                      <Field
                        id="registration-category"
                        label="Categoría del hermano"
                        error={errors.category}
                        hint={
                          isMinor
                            ? "Los menores de 18 años solo pueden ser postulantes."
                            : "Todo nuevo registro empieza como Postulante. Cambia a Activo solo si ya superó su prueba y juramentó."
                        }
                      >
                        <select
                          id="registration-category"
                          value={draft.category}
                          disabled={isMinor}
                          className={selectClass}
                          aria-invalid={Boolean(errors.category)}
                          aria-describedby={
                            errors.category
                              ? "registration-category-error"
                              : undefined
                          }
                          onChange={(event) =>
                            update(
                              "category",
                              event.target.value as MemberDraft["category"],
                            )
                          }
                        >
                          <option value="postulante">Postulante</option>
                          <option
                            value="activo"
                            disabled={!hasBirthDate || isMinor}
                          >
                            Activo
                          </option>
                        </select>
                      </Field>
                      {input(
                        "swornAt",
                        `Fecha de juramentación${draft.category === "activo" ? " *" : " (si corresponde)"}`,
                        {
                          type: "date",
                          min: draft.joinedAt || draft.birthDate || undefined,
                          max: todayDate(),
                          required: draft.category === "activo",
                        },
                        "Es distinta de la fecha de ingreso. Desde ella se cuentan los 30 años para la categoría Vitalicio.",
                      )}
                      <div className="flex items-start gap-3 rounded-sm bg-paper p-4 sm:col-span-2">
                        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-clay-text" />
                        <p className="text-sm leading-6 text-muted">
                          El usuario se creará con perfil{" "}
                          <strong className="text-ink">Estándar</strong>, con
                          acceso a Mi perfil y Mi estado de cuenta. La categoría
                          del hermano es independiente del perfil de acceso.
                        </p>
                      </div>
                    </div>
                  )}

                  {step === "review" && (
                    <div>
                      <dl className="grid gap-x-8 sm:grid-cols-2">
                        <SummaryItem
                          label="Nombres y apellidos"
                          value={draft.fullName}
                        />
                        <SummaryItem label="DNI" value={draft.dni} />
                        <SummaryItem
                          label="Fecha de nacimiento"
                          value={`${draft.birthDate} · ${age} años`}
                        />
                        <SummaryItem
                          label="Tipo de ficha"
                          value={isMinor ? "Menor de edad" : "Mayor de edad"}
                        />
                        <SummaryItem label="Dirección" value={draft.address} />
                        <SummaryItem label="Celular" value={draft.phone} />
                        <SummaryItem
                          label="Correo electrónico"
                          value={
                            draft.email ||
                            "Sin correo; ingresará con su usuario"
                          }
                        />
                        <SummaryItem
                          label="Profesión u ocupación"
                          value={draft.occupation}
                        />
                        <SummaryItem
                          label="Estado civil"
                          value={draft.maritalStatus}
                        />
                        <SummaryItem
                          label="Sacramentos"
                          value={draft.sacraments.join(", ")}
                        />
                        <SummaryItem
                          label="Fecha de ingreso"
                          value={draft.joinedAt}
                        />
                        <SummaryItem
                          label="Fecha de juramentación"
                          value={draft.swornAt || "Aún no juramenta"}
                        />
                        <SummaryItem
                          label="Categoría"
                          value={categoryLabels[draft.category]}
                        />
                        <SummaryItem
                          label="Perfil de acceso"
                          value="Estándar"
                        />
                      </dl>
                      {isMinor && draft.guardian && (
                        <section
                          className="mt-6"
                          aria-labelledby="guardian-review-title"
                        >
                          <h4
                            id="guardian-review-title"
                            className="font-display text-lg"
                          >
                            Apoderado
                          </h4>
                          <dl className="mt-2 grid gap-x-8 sm:grid-cols-2">
                            <SummaryItem
                              label="Nombres y apellidos"
                              value={draft.guardian.fullName}
                            />
                            <SummaryItem
                              label="DNI"
                              value={draft.guardian.dni}
                            />
                            <SummaryItem
                              label="Parentesco"
                              value={draft.guardian.relationship}
                            />
                            <SummaryItem
                              label="Edad"
                              value={draft.guardian.age}
                            />
                            <SummaryItem
                              label="Grado de instrucción"
                              value={draft.guardian.education}
                            />
                            <SummaryItem
                              label="Dirección"
                              value={draft.guardian.address}
                            />
                            <SummaryItem
                              label="Celular"
                              value={draft.guardian.phone}
                            />
                            <SummaryItem
                              label="Sacramentos"
                              value={draft.guardian.sacraments.join(", ")}
                            />
                          </dl>
                        </section>
                      )}
                      <div className="mt-6 flex gap-3 rounded-sm border border-line bg-paper p-4">
                        <KeyRound className="mt-0.5 size-5 shrink-0 text-clay-text" />
                        <div>
                          <p className="text-sm font-semibold">
                            Acceso automático al guardar
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            Se asignarán un usuario único y una contraseña
                            inicial. Las credenciales aparecerán al finalizar
                            para que puedas entregárselas al hermano.
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs leading-5 text-muted">
                        Las firmas del hermano y del apoderado corresponden a la
                        ficha física de inscripción.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            {message && (
              <p
                className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                {message}
              </p>
            )}
            {Object.keys(errors).some((key) => errors[key]) && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                Revisa los campos indicados antes de continuar.
                {step === "review" && (
                  <span> Usa Anterior para corregir la ficha.</span>
                )}
              </p>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-line bg-white-warm px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            {credentials ? (
              <>
                <p className="text-xs text-muted">
                  Ficha registrada y usuario habilitado.
                </p>
                <Button type="button" onClick={onClose}>
                  <Check className="size-4" />
                  Volver al padrón
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || readingPhoto}
                  onClick={requestClose}
                >
                  Cancelar
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  {stepIndex > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || readingPhoto}
                      onClick={() => goTo(steps[stepIndex - 1])}
                    >
                      <ArrowLeft className="size-4" />
                      <span>Anterior</span>
                    </Button>
                  )}
                  <Button type="submit" disabled={busy || readingPhoto}>
                    {busy
                      ? "Guardando…"
                      : step === "review"
                        ? "Guardar y crear acceso"
                        : "Siguiente"}
                    {step === "review" ? (
                      <KeyRound className="size-4" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </footer>
      </form>
    </dialog>
  );
}

export { MemberRegistration };
