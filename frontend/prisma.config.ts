import { defineConfig } from '@prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        provider: 'postgresql',

        // URL usada pelo Prisma Client
        url: process.env.DATABASE_URL!,

        // URL direta (porta 5432) usada pelo Prisma Migrate
        directUrl: process.env.DIRECT_URL!,
    },
});
