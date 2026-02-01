-- CreateTable
CREATE TABLE "socio_config" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pctSocio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socio_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "socio_config_localId_key" ON "socio_config"("localId");

-- AddForeignKey
ALTER TABLE "socio_config" ADD CONSTRAINT "socio_config_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
