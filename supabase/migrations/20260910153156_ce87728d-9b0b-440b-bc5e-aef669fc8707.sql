UPDATE public.rp_email_templates SET corpo_html = '<div style="background-color:#F1F5F9;margin:0;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Helvetica,Arial,sans-serif;">
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#ffffff;border:1px solid #E5EAF0;border-radius:16px;overflow:hidden;">
<tr><td style="padding:22px 28px 18px;background-color:#EEF5FA;border-bottom:1px solid #E5EAF0;">
<img src="https://hub.lavoroseguros.com.br/__l5e/assets-v1/1a15787d-0339-491f-9940-809b91f21630/logo-lavoro-email.png" alt="Lavoro Seguros" height="32" style="height:32px;width:auto;display:block;border:0;" />
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:#00BAF2;">&nbsp;</td></tr>
<tr><td style="padding:28px;">
<p style="color:#00BAF2;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Controle de Posições · RH</p>
<h1 style="font-size:22px;line-height:30px;font-weight:700;color:#0E2E43;margin:0 0 16px;">Nova reserva registrada</h1>
<p style="font-size:15px;color:#1F2937;line-height:23px;margin:0 0 12px;"><strong>{{nome}}</strong> reservou uma posição no escritório de SP.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:16px 0 4px;border:1px solid #E5EAF0;border-radius:8px;overflow:hidden;">
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;">Colaborador</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;">{{nome}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Posição</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{posicao}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Data</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{data}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Horário</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{hora_inicio}} às {{hora_fim}}</td></tr>
</table>
<p style="font-size:13px;color:#6B7280;line-height:20px;margin:18px 0 0;">Mensagem apenas para controle do RH. A visão completa do período está no Hub, em <strong>RH › Controle de Posições</strong>.</p>
<p style="font-size:13px;color:#6B7280;line-height:20px;margin:24px 0 0;border-top:1px solid #E5EAF0;padding-top:16px;">Em caso de dúvidas, envie um e-mail para <a href="mailto:operacoes@lavoroseguros.com.br" style="color:#14405C;font-weight:700;text-decoration:underline;">operacoes@lavoroseguros.com.br</a>.</p>
</td></tr>
<tr><td style="padding:0 28px 26px;font-size:11px;color:#6B7280;text-align:center;line-height:18px;">
© 2026 Lavoro Seguros — Todos os direitos reservados.<br />
Mensagem automática, por favor não responda este e-mail.<br />
<span style="color:#0E2E43;font-weight:700;">Equipe de Dados e IA</span>
</td></tr></table></div>' WHERE tipo = 'rh_confirmacao';

UPDATE public.rp_email_templates SET corpo_html = '<div style="background-color:#F1F5F9;margin:0;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Helvetica,Arial,sans-serif;">
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#ffffff;border:1px solid #E5EAF0;border-radius:16px;overflow:hidden;">
<tr><td style="padding:22px 28px 18px;background-color:#EEF5FA;border-bottom:1px solid #E5EAF0;">
<img src="https://hub.lavoroseguros.com.br/__l5e/assets-v1/1a15787d-0339-491f-9940-809b91f21630/logo-lavoro-email.png" alt="Lavoro Seguros" height="32" style="height:32px;width:auto;display:block;border:0;" />
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:#00BAF2;">&nbsp;</td></tr>
<tr><td style="padding:28px;">
<p style="color:#00BAF2;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Controle de Posições · RH</p>
<h1 style="font-size:22px;line-height:30px;font-weight:700;color:#0E2E43;margin:0 0 16px;">Reserva cancelada</h1>
<p style="font-size:15px;color:#1F2937;line-height:23px;margin:0 0 12px;"><strong>{{nome}}</strong> cancelou a reserva abaixo. A posição voltou a ficar disponível para o time.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:16px 0 4px;border:1px solid #E5EAF0;border-radius:8px;overflow:hidden;">
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;">Colaborador</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;">{{nome}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Posição</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{posicao}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Data</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{data}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Horário</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{hora_inicio}} às {{hora_fim}}</td></tr>
</table>
<p style="font-size:13px;color:#6B7280;line-height:20px;margin:18px 0 0;">Mensagem apenas para controle do RH. A visão completa do período está no Hub, em <strong>RH › Controle de Posições</strong>.</p>
<p style="font-size:13px;color:#6B7280;line-height:20px;margin:24px 0 0;border-top:1px solid #E5EAF0;padding-top:16px;">Em caso de dúvidas, envie um e-mail para <a href="mailto:operacoes@lavoroseguros.com.br" style="color:#14405C;font-weight:700;text-decoration:underline;">operacoes@lavoroseguros.com.br</a>.</p>
</td></tr>
<tr><td style="padding:0 28px 26px;font-size:11px;color:#6B7280;text-align:center;line-height:18px;">
© 2026 Lavoro Seguros — Todos os direitos reservados.<br />
Mensagem automática, por favor não responda este e-mail.<br />
<span style="color:#0E2E43;font-weight:700;">Equipe de Dados e IA</span>
</td></tr></table></div>' WHERE tipo = 'rh_cancelamento';

UPDATE public.rp_email_templates SET corpo_html = '<div style="background-color:#F1F5F9;margin:0;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Helvetica,Arial,sans-serif;">
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#ffffff;border:1px solid #E5EAF0;border-radius:16px;overflow:hidden;">
<tr><td style="padding:22px 28px 18px;background-color:#EEF5FA;border-bottom:1px solid #E5EAF0;">
<img src="https://hub.lavoroseguros.com.br/__l5e/assets-v1/1a15787d-0339-491f-9940-809b91f21630/logo-lavoro-email.png" alt="Lavoro Seguros" height="32" style="height:32px;width:auto;display:block;border:0;" />
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:#00BAF2;">&nbsp;</td></tr>
<tr><td style="padding:28px;">
<p style="color:#00BAF2;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Controle de Posições · RH</p>
<h1 style="font-size:22px;line-height:30px;font-weight:700;color:#B91C1C;margin:0 0 16px;">Ausência registrada</h1>
<p style="font-size:15px;color:#1F2937;line-height:23px;margin:0 0 12px;"><strong>{{nome}}</strong> não realizou o check-in dentro do prazo de {{tolerancia_min}} minutos. A reserva foi cancelada e a posição liberada.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:16px 0 4px;border:1px solid #E5EAF0;border-radius:8px;overflow:hidden;">
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;">Colaborador</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;">{{nome}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Posição</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{posicao}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Data</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{data}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Horário</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{hora_inicio}} às {{hora_fim}}</td></tr>
</table>
<p style="font-size:13px;color:#6B7280;line-height:20px;margin:18px 0 0;">Mensagem apenas para controle do RH. A visão completa do período está no Hub, em <strong>RH › Controle de Posições</strong>.</p>
<p style="font-size:13px;color:#6B7280;line-height:20px;margin:24px 0 0;border-top:1px solid #E5EAF0;padding-top:16px;">Em caso de dúvidas, envie um e-mail para <a href="mailto:operacoes@lavoroseguros.com.br" style="color:#14405C;font-weight:700;text-decoration:underline;">operacoes@lavoroseguros.com.br</a>.</p>
</td></tr>
<tr><td style="padding:0 28px 26px;font-size:11px;color:#6B7280;text-align:center;line-height:18px;">
© 2026 Lavoro Seguros — Todos os direitos reservados.<br />
Mensagem automática, por favor não responda este e-mail.<br />
<span style="color:#0E2E43;font-weight:700;">Equipe de Dados e IA</span>
</td></tr></table></div>' WHERE tipo = 'rh_ausencia';