import 'reflect-metadata';
import './common/session.types';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONFIG, loadConfig, type AppConfig } from './config/config';
import { configureHttp } from './http-security';

async function bootstrap() {
  // Fail fast on invalid configuration before anything else starts.
  loadConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  const config = app.get<AppConfig>(APP_CONFIG);
  configureHttp(app, config);
  app.enableShutdownHooks();

  await app.listen(config.PORT, config.HOST);
  app
    .get(Logger)
    .log(
      `API listening on ${config.HOST}:${config.PORT} (${config.NODE_ENV}, auth=${config.AUTH_MODE})`,
    );
}

bootstrap().catch((err: unknown) => {
  // Logger may not exist yet; write a single structured line and exit non-zero.
  process.stderr.write(
    `${JSON.stringify({ level: 'fatal', msg: err instanceof Error ? err.message : String(err) })}\n`,
  );
  process.exit(1);
});
