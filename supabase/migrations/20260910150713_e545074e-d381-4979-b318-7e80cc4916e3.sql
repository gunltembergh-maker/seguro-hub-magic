DO $mig$
DECLARE
  v_topo text := $h$<div style="background-color:#F1F5F9;margin:0;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5EAF0;box-shadow:0 10px 40px rgba(14,46,67,0.10);">
<div style="background:linear-gradient(180deg,#ffffff 0%,#EEF5FA 100%);padding:26px 32px 20px;border-bottom:1px solid #E5EAF0;">
<img src="https://hub.lavoroseguros.com.br/__l5e/assets-v1/1a15787d-0339-491f-9940-809b91f21630/logo-lavoro-email.png" alt="Lavoro Seguros" height="34" style="height:34px;width:auto;display:block;" />
</div>
<div style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#00BAF2 0%,#14405C 100%);">&nbsp;</div>
<div style="padding:36px 34px 28px;">
<p style="color:#00BAF2;font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;margin:0 0 14px;">Reserva de Posições</p>$h$;
  v_rodape text := $h$</div>
<div style="padding:0 32px 30px;font-size:11px;color:#6B7280;text-align:center;line-height:18px;">
© 2026 Lavoro Seguros — Todos os direitos reservados.<br />
Mensagem automática, por favor não responda este e-mail.<br />
<span style="color:#0E2E43;font-weight:700;">Equipe de Dados e IA</span>
</div></div></div>$h$;
  v_tabela text := $h$<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:20px 0 8px;border:1px solid #E5EAF0;border-radius:10px;overflow:hidden;">
<tr><td style="padding:12px 16px;background-color:#EEF5FA;font-size:13px;color:#6B7280;width:40%;">Posição</td><td style="padding:12px 16px;font-size:14px;color:#0E2E43;font-weight:700;">{{posicao}}</td></tr>
<tr><td style="padding:12px 16px;background-color:#EEF5FA;font-size:13px;color:#6B7280;border-top:1px solid #E5EAF0;">Data</td><td style="padding:12px 16px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{data}}</td></tr>
<tr><td style="padding:12px 16px;background-color:#EEF5FA;font-size:13px;color:#6B7280;border-top:1px solid #E5EAF0;">Horário</td><td style="padding:12px 16px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{hora_inicio}} às {{hora_fim}}</td></tr>
</table>$h$;
  v_p text := 'font-size:15px;color:#1F2937;line-height:24px;margin:0 0 14px;';
BEGIN
  UPDATE public.rp_email_templates SET corpo_html =
    v_topo
    || '<h1 style="font-size:24px;line-height:32px;font-weight:700;color:#0E2E43;margin:0 0 20px;letter-spacing:-0.3px;">Reserva confirmada</h1>'
    || '<p style="' || v_p || '">Olá, {{nome}}.</p>'
    || '<p style="' || v_p || '">Sua reserva no escritório de SP foi registrada e confirmada com sucesso:</p>'
    || v_tabela
    || '<div style="background-color:#EEF5FA;border-left:3px solid #00BAF2;padding:14px 18px;border-radius:10px;margin:22px 0 8px;font-size:13px;color:#0E2E43;line-height:20px;">Sua reserva é válida até <strong>{{tolerancia_min}} minutos</strong> após o horário de início. Passando desse prazo sem o check-in, a reserva será cancelada e a posição ficará disponível para o time.</div>'
    || '<div style="border-top:1px solid #E5EAF0;margin:28px 0 20px;height:0;line-height:0;font-size:0;">&nbsp;</div>'
    || '<h2 style="font-size:17px;line-height:24px;font-weight:700;color:#0E2E43;margin:0 0 12px;">Check-in ao chegar</h2>'
    || '<ol style="' || v_p || 'padding-left:20px;"><li style="margin-bottom:6px;">Conecte-se ao Wi-Fi do escritório.</li><li style="margin-bottom:6px;">Acesse o Hub e abra o menu <strong>Reserva de Posições</strong>.</li><li>Na aba <strong>Minhas reservas</strong>, clique em <strong>Fazer check-in</strong> na sua reserva do dia.</li></ol>'
    || '<p style="font-size:13px;color:#6B7280;line-height:20px;margin:14px 0 0;">O check-in fica disponível a partir de <strong>{{checkin_antes_min}} minutos</strong> antes do horário de início.</p>'
    || v_rodape
  WHERE tipo = 'confirmacao';

  UPDATE public.rp_email_templates SET corpo_html =
    v_topo
    || '<h1 style="font-size:24px;line-height:32px;font-weight:700;color:#0E2E43;margin:0 0 20px;letter-spacing:-0.3px;">Reserva cancelada</h1>'
    || '<p style="' || v_p || '">Olá, {{nome}}.</p>'
    || '<p style="' || v_p || '">Sua reserva no escritório de SP foi cancelada com sucesso:</p>'
    || v_tabela
    || '<p style="' || v_p || 'margin-top:20px;">A posição voltou a ficar disponível para o time. Se precisar, faça uma nova reserva pelo Hub em <strong>Reserva de Posições</strong>.</p>'
    || v_rodape
  WHERE tipo = 'cancelamento';

  UPDATE public.rp_email_templates SET corpo_html =
    v_topo
    || '<h1 style="font-size:24px;line-height:32px;font-weight:700;color:#0E2E43;margin:0 0 20px;letter-spacing:-0.3px;">Reserva não confirmada</h1>'
    || '<p style="' || v_p || '">Olá, {{nome}}.</p>'
    || '<p style="' || v_p || '">Sua reserva no escritório de SP não foi confirmada:</p>'
    || v_tabela
    || '<div style="background-color:#FEF2F2;border-left:3px solid #DC2626;padding:14px 18px;border-radius:10px;margin:22px 0 8px;font-size:13px;color:#0E2E43;line-height:20px;">O check-in não foi realizado em até <strong>{{tolerancia_min}} minutos</strong> após o horário de início, então a reserva foi cancelada e a posição ficou disponível para o time. O RH foi notificado desta ausência.</div>'
    || '<p style="' || v_p || 'margin-top:18px;">Se você esteve no escritório e não conseguiu fazer o check-in, fale com o administrador do Hub.</p>'
    || v_rodape
  WHERE tipo = 'ausencia';
END
$mig$;