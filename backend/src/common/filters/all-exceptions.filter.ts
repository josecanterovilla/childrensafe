import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Filtro global de errores: respuestas uniformes y SIN filtrar detalles internos al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'InternalServerError';
    // Código de aplicación opcional (p. ej. 'EMAIL_NOT_VERIFIED') para que el cliente reaccione.
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? message;
        error = (b.error as string) ?? exception.name;
        code = (b.code as string) ?? undefined;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Errores conocidos de Prisma mapeados a códigos HTTP seguros.
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'El recurso ya existe';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Recurso no encontrado';
        error = 'NotFound';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Solicitud inválida';
        error = 'BadRequest';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      ...(code ? { code } : {}),
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
