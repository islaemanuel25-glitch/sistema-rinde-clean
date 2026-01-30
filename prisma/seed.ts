import bcrypt from "bcryptjs";
import { PrismaClient, RolLocal, TipoMovimiento, CategoriaAccion } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Credenciales iniciales
  const email = "admin@rinde.com";
  const password = "admin123";
  const passwordHash = await bcrypt.hash(password, 12);

  // Local inicial
  const local = await prisma.local.upsert({
    where: { id: "seed-local-1" },
    update: {},
    create: {
      id: "seed-local-1",
      nombre: "Local 1",
      isActive: true,
    },
  });

  // Usuario admin
  const user = await prisma.user.upsert({
    where: { email },
    update: { isActive: true },
    create: {
      email,
      passwordHash,
      isActive: true,
    },
  });

  // Asignación usuario-local (ADMIN)
  await prisma.userLocal.upsert({
    where: {
      userId_localId: { userId: user.id, localId: local.id },
    },
    update: { rol: RolLocal.ADMIN, isActive: true },
    create: {
      userId: user.id,
      localId: local.id,
      rol: RolLocal.ADMIN,
      isActive: true,
    },
  });

  // Acciones base mínimas
  const accionesBase = [
    { nombre: "Caja turno", tipoDefault: TipoMovimiento.ENTRADA, categoria: CategoriaAccion.TURNO },
    { nombre: "Pago depósito", tipoDefault: TipoMovimiento.SALIDA, categoria: CategoriaAccion.DEPOSITO },
    { nombre: "Electrónico", tipoDefault: TipoMovimiento.ENTRADA, categoria: CategoriaAccion.ELECTRONICO },
    { nombre: "Socio", tipoDefault: TipoMovimiento.SALIDA, categoria: CategoriaAccion.SOCIO },
    { nombre: "Otros", tipoDefault: TipoMovimiento.SALIDA, categoria: CategoriaAccion.OTROS },
  ];

  for (const a of accionesBase) {
    const accion = await prisma.accion.upsert({
      where: { nombre: a.nombre },
      update: {
        tipoDefault: a.tipoDefault,
        categoria: a.categoria,
        isActive: true,
      },
      create: {
        nombre: a.nombre,
        descripcion: null,
        tipoDefault: a.tipoDefault,
        impactaTotalDefault: true,
        usaTurno: a.categoria === CategoriaAccion.TURNO,
        usaNombre: false,
        requierePermisoEspecial: false,
        categoria: a.categoria,
        isActive: true,
      },
    });

    await prisma.accionLocal.upsert({
      where: {
        localId_accionId: { localId: local.id, accionId: accion.id },
      },
      update: { isEnabled: true },
      create: {
        localId: local.id,
        accionId: accion.id,
        isEnabled: true,
        orden: 0,
        impactaTotal: true,
      },
    });
  }

  console.log("SEED OK");
  console.log("Login: admin@rinde.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
