import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createYogaServer } from './yoga-server';



async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    app.enableCors({
    origin: true, // Allow all origins (or specify your frontend URL)
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PATCH'], // SSE uses GET
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow auth headers
    credentials: true, // Required if using cookies/tokens
    exposedHeaders: ['Content-Type', 'Authorization', 'text/event-stream'], // Required for SSE
  });
  const expressApp = app.getHttpAdapter().getInstance();
  const yoga = createYogaServer(app);
  expressApp.use('/graphql', yoga);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
