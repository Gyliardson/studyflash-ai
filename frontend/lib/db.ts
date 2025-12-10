import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
    // 1. Criamos a conexão com o banco usando o driver 'pg'
    // Isso resolve o problema de não ter URL no schema
    const connectionString = process.env.DATABASE_URL;

    const pool = new Pool({ connectionString });

    // 2. Criamos o adaptador do Prisma
    const adapter = new PrismaPg(pool);

    // 3. Iniciamos o Prisma passando o adaptador
    return new PrismaClient({ adapter });
};

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;