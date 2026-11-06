# HCSMP Backoffice

Portal interno de muestra para la Hermandad de Cargadores de San Martín de
Porres de Cruz Blanca. Su identidad visual acompaña al sitio público de HCSMP.

## Desarrollo

```bash
npm install
npm run dev
```

La ruta `/` muestra el formulario de acceso y `/dashboard` el panel de ejemplo.
El formulario solo demuestra la navegación: no valida credenciales ni crea
cuentas. Las métricas, actividades y módulos del dashboard son datos
ilustrativos.

## Stack

- Next.js App Router, React y TypeScript
- Tailwind CSS v4
- Primitivas de interfaz accesibles con el enfoque shadcn/ui

## Validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
