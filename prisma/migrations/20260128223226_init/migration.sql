-- CreateEnum
CREATE TYPE "RolLocal" AS ENUM ('ADMIN', 'OPERATIVO', 'LECTURA');

-- CreateEnum
CREATE TYPE "ScopePreset" AS ENUM ('GLOBAL', 'LOCAL');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANIANA', 'TARDE', 'NOCHE');

-- CreateEnum
CREATE TYPE "CategoriaAccion" AS ENUM ('TURNO', 'DEPOSITO', 'ELECTRONICO', 'SOCIO', 'OTROS');

-- CreateEnum
CREATE TYPE "PresetItemTipo" AS ENUM ('ACCION', 'CATEGORIA', 'SOCIO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_locales" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "rol" "RolLocal" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoDefault" "TipoMovimiento" NOT NULL,
    "impactaTotalDefault" BOOLEAN NOT NULL DEFAULT true,
    "usaTurno" BOOLEAN NOT NULL DEFAULT false,
    "usaNombre" BOOLEAN NOT NULL DEFAULT false,
    "requierePermisoEspecial" BOOLEAN NOT NULL DEFAULT false,
    "categoria" "CategoriaAccion" NOT NULL DEFAULT 'OTROS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acciones_local" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "accionId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "tipoOverride" "TipoMovimiento",
    "impactaTotal" BOOLEAN NOT NULL DEFAULT true,
    "impactaTotalDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usaTurnoOverride" BOOLEAN,
    "usaNombreOverride" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acciones_local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presets" (
    "id" TEXT NOT NULL,
    "scope" "ScopePreset" NOT NULL,
    "localId" TEXT,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preset_items" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "tipo" "PresetItemTipo" NOT NULL,
    "accionId" TEXT,
    "categoria" "CategoriaAccion",
    "socioId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "preset_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "accionId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "importe" DECIMAL(65,30) NOT NULL,
    "turno" "Turno",
    "nombre" TEXT,
    "socioId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_locales_localId_idx" ON "user_locales"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "user_locales_userId_localId_key" ON "user_locales"("userId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "acciones_nombre_key" ON "acciones"("nombre");

-- CreateIndex
CREATE INDEX "acciones_local_localId_isEnabled_orden_idx" ON "acciones_local"("localId", "isEnabled", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "acciones_local_localId_accionId_key" ON "acciones_local"("localId", "accionId");

-- CreateIndex
CREATE INDEX "presets_scope_localId_orden_idx" ON "presets"("scope", "localId", "orden");

-- CreateIndex
CREATE INDEX "preset_items_presetId_orden_idx" ON "preset_items"("presetId", "orden");

-- CreateIndex
CREATE INDEX "socios_localId_idx" ON "socios"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "socios_localId_nombre_key" ON "socios"("localId", "nombre");

-- CreateIndex
CREATE INDEX "movimientos_localId_fecha_idx" ON "movimientos"("localId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_localId_fecha_accionId_idx" ON "movimientos"("localId", "fecha", "accionId");

-- AddForeignKey
ALTER TABLE "user_locales" ADD CONSTRAINT "user_locales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locales" ADD CONSTRAINT "user_locales_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acciones_local" ADD CONSTRAINT "acciones_local_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acciones_local" ADD CONSTRAINT "acciones_local_accionId_fkey" FOREIGN KEY ("accionId") REFERENCES "acciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presets" ADD CONSTRAINT "presets_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preset_items" ADD CONSTRAINT "preset_items_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preset_items" ADD CONSTRAINT "preset_items_accionId_fkey" FOREIGN KEY ("accionId") REFERENCES "acciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preset_items" ADD CONSTRAINT "preset_items_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_accionId_fkey" FOREIGN KEY ("accionId") REFERENCES "acciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "socios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
