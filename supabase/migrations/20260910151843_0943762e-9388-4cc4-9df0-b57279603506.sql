DO $mig$
DECLARE
  v_topo text := $h$<div style="background-color:#F1F5F9;margin:0;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#ffffff;border:1px solid #E5EAF0;border-radius:16px;overflow:hidden;">
<tr><td style="padding:22px 28px 18px;background-color:#EEF5FA;border-bottom:1px solid #E5EAF0;">
<img src="https://hub.lavoroseguros.com.br/__l5e/assets-v1/1a15787d-0339-491f-9940-809b91f21630/logo-lavoro-email.png" alt="Lavoro Seguros" height="32" style="height:32px;width:auto;display:block;border:0;" />
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:#00BAF2;">&nbsp;</td></tr>
<tr><td style="padding:28px;">
<p style="color:#00BAF2;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Reserva de Posições</p>$h$;
  v_suporte text := $h$<p style="font-size:13px;color:#6B7280;line-height:20px;margin:24px 0 0;border-top:1px solid #E5EAF0;padding-top:16px;">Em caso de dúvidas, problemas de acesso, com o check-in ou com a reserva, envie um e-mail com a evidência (print da tela) para <a href="mailto:operacoes@lavoroseguros.com.br" style="color:#14405C;font-weight:700;text-decoration:underline;">operacoes@lavoroseguros.com.br</a>.</p>$h$;
  v_rodape text := $h$</td></tr>
<tr><td style="padding:0 28px 26px;font-size:11px;color:#6B7280;text-align:center;line-height:18px;">
© 2026 Lavoro Seguros — Todos os direitos reservados.<br />
Mensagem automática, por favor não responda este e-mail.<br />
<span style="color:#0E2E43;font-weight:700;">Equipe de Dados e IA</span>
</td></tr></table></div>$h$;
  v_tabela text := $h$<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:16px 0 4px;border:1px solid #E5EAF0;border-radius:8px;overflow:hidden;">
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;">Posição</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;">{{posicao}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Data</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{data}}</td></tr>
<tr><td width="35%" style="width:35%;padding:8px 10px;background-color:#EEF5FA;font-size:14px;color:#6B7280;border-top:1px solid #E5EAF0;">Horário</td><td style="padding:8px 10px;font-size:14px;color:#0E2E43;font-weight:700;border-top:1px solid #E5EAF0;">{{hora_inicio}} às {{hora_fim}}</td></tr>
</table>$h$;
  v_p text := 'font-size:15px;color:#1F2937;line-height:23px;margin:0 0 12px;';
  v_h1 text := 'font-size:22px;line-height:30px;font-weight:700;color:#0E2E43;margin:0 0 16px;';
BEGIN
  UPDATE public.rp_email_templates SET corpo_html =
    v_topo
    || '<h1 style="' || v_h1 || '">Reserva confirmada</h1>'
    || '<p style="' || v_p || '">Olá, {{nome}}.</p>'
    || '<p style="' || v_p || '">Sua reserva no escritório de SP foi registrada e confirmada com sucesso:</p>'
    || v_tabela
    || '<div style="background-color:#EEF5FA;border-left:3px solid #00BAF2;padding:12px 14px;border-radius:8px;margin:18px 0 6px;font-size:13px;color:#0E2E43;line-height:20px;">Sua reserva é válida até <strong>{{tolerancia_min}} minutos</strong> após o horário de início. Passando desse prazo sem o check-in, a reserva será cancelada e a posição ficará disponível para o time.</div>'
    || '<h2 style="font-size:16px;line-height:22px;font-weight:700;color:#0E2E43;margin:22px 0 10px;">Check-in ao chegar</h2>'
    || '<ol style="' || v_p || 'padding-left:18px;"><li style="margin-bottom:5px;">Conecte-se ao Wi-Fi do escritório.</li><li style="margin-bottom:5px;">Acesse o Hub e abra o menu <strong>Reserva de Posições</strong>.</li><li>Na aba <strong>Minhas reservas</strong>, clique em <strong>Fazer check-in</strong> na sua reserva do dia.</li></ol>'
    || '<p style="font-size:13px;color:#6B7280;line-height:20px;margin:12px 0 0;">O check-in fica disponível a partir de <strong>{{checkin_antes_min}} minutos</strong> antes do horário de início.</p>'
    || v_suporte || v_rodape
  WHERE tipo = 'confirmacao';

  UPDATE public.rp_email_templates SET corpo_html =
    v_topo
    || '<h1 style="' || v_h1 || '">Reserva cancelada</h1>'
    || '<p style="' || v_p || '">Olá, {{nome}}.</p>'
    || '<p style="' || v_p || '">Sua reserva no escritório de SP foi cancelada com sucesso:</p>'
    || v_tabela
    || '<p style="' || v_p || 'margin-top:16px;">A posição voltou a ficar disponível para o time. Se precisar, faça uma nova reserva pelo Hub em <strong>Reserva de Posições</strong>.</p>'
    || v_suporte || v_rodape
  WHERE tipo = 'cancelamento';

  UPDATE public.rp_email_templates SET corpo_html =
    v_topo
    || '<h1 style="' || v_h1 || '">Reserva não confirmada</h1>'
    || '<p style="' || v_p || '">Olá, {{nome}}.</p>'
    || '<p style="' || v_p || '">Sua reserva no escritório de SP não foi confirmada:</p>'
    || v_tabela
    || '<div style="background-color:#FEF2F2;border-left:3px solid #DC2626;padding:12px 14px;border-radius:8px;margin:18px 0 6px;font-size:13px;color:#0E2E43;line-height:20px;">O check-in não foi realizado em até <strong>{{tolerancia_min}} minutos</strong> após o horário de início, então a reserva foi cancelada e a posição ficou disponível para o time. O RH foi notificado desta ausência.</div>'
    || '<p style="' || v_p || 'margin-top:16px;">Se você esteve no escritório e não conseguiu fazer o check-in, fale com o administrador do Hub.</p>'
    || v_suporte || v_rodape
  WHERE tipo = 'ausencia';
END
$mig$;

-- Garante que administradores consigam gravar/criar parâmetros do Hub
DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='hub_admin_settings'
      AND policyname='hub_admin_settings admins update'
  ) THEN
    CREATE POLICY "hub_admin_settings admins update"
      ON public.hub_admin_settings FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'ADMIN'))
      WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='hub_admin_settings'
      AND policyname='hub_admin_settings admins insert'
  ) THEN
    CREATE POLICY "hub_admin_settings admins insert"
      ON public.hub_admin_settings FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
  END IF;
END
$pol$;