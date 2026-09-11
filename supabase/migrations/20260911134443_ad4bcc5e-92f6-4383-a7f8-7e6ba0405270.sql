UPDATE rp_email_templates
SET corpo_html = REPLACE(corpo_html, 'Em caso de dúvidas', '{{linha_motivo}}Em caso de dúvidas')
WHERE tipo = 'rh_cancelamento'
  AND corpo_html NOT LIKE '%linha_motivo%'
  AND corpo_html LIKE '%Em caso de dúvidas%';