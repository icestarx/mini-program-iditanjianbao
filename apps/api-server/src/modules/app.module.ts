import { Module } from '@nestjs/common';
import { StallsModule } from './stalls/stalls.module.js';
import { PrismaModule } from './database/prisma.module.js';

@Module({ imports: [PrismaModule, StallsModule] })
export class AppModule {}
