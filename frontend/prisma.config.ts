// Atenção: O import correto é 'prisma/config' e não '@prisma/config'
import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: process.env.DIRECT_URL ?? '',
    },
});