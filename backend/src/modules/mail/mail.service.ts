import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailCodePurpose } from '@prisma/client';
import { Resend } from 'resend';

/**
 * Envío de correos transaccionales (códigos de confirmación y de recuperación).
 *
 * - Con `RESEND_API_KEY` configurada, envía de verdad vía Resend.
 * - Sin clave (desarrollo/pruebas), registra el código en los logs y no falla: así el flujo
 *   completo funciona en local y en los tests sin depender de un proveedor externo.
 *
 * El envío nunca propaga errores al llamador: la cuenta ya existe y el usuario puede reenviar.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('mail.resendApiKey') ?? '';
    this.from = config.get<string>('mail.from') ?? 'ChildrenSafe <onboarding@resend.dev>';
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendCode(to: string, code: string, purpose: EmailCodePurpose): Promise<void> {
    const { subject, intro } = this.content(purpose);

    if (!this.resend) {
      this.logger.warn(`[mail:dev] (${purpose}) código para ${to}: ${code}`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html: this.html(subject, intro, code),
        text: `${intro}\n\n${code}\n\nEl código caduca en 10 minutos. Si no fuiste tú, ignora este mensaje.`,
      });
    } catch (err) {
      this.logger.error(`No se pudo enviar el correo a ${to}: ${(err as Error).message}`);
    }
  }

  private content(purpose: EmailCodePurpose): { subject: string; intro: string } {
    if (purpose === EmailCodePurpose.VERIFY_EMAIL) {
      return {
        subject: 'Confirma tu cuenta de ChildrenSafe',
        intro: 'Tu código para confirmar tu cuenta es:',
      };
    }
    return {
      subject: 'Recupera tu contraseña de ChildrenSafe',
      intro: 'Tu código para cambiar la contraseña es:',
    };
  }

  private html(subject: string, intro: string, code: string): string {
    return `
<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f6f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td>
            <h1 style="margin:0 0 8px;font-size:20px;color:#1f2937;">ChildrenSafe</h1>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${subject}</p>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">${intro}</p>
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#2E7D6B;text-align:center;padding:16px 0;">${code}</div>
            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">El código caduca en 10 minutos. Si no fuiste tú, puedes ignorar este mensaje.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();
  }
}
