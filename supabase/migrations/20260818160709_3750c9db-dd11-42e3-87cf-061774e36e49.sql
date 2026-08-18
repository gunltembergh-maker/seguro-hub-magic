CREATE OR REPLACE FUNCTION public.lavoro_normaliza_seguradora(p_seguradora text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_seguradora IS NULL OR btrim(p_seguradora) = '' THEN NULL
    ELSE CASE regexp_replace(lower(btrim(p_seguradora)), '[^a-z0-9]', '', 'g')
      WHEN 'sulamrica' THEN 'Sul América'
      WHEN 'tokio' THEN 'Tokio Marine'
      WHEN 'tokiomarine' THEN 'Tokio Marine'
      WHEN 'aig' THEN 'AIG'
      WHEN 'akad' THEN 'Akad'
      WHEN 'alice' THEN 'Alice'
      WHEN 'allianzeulerhermes' THEN 'Allianz (Euler Hermes)'
      WHEN 'allseguro' THEN 'All Seguro'
      WHEN 'alpha' THEN 'Alpha'
      WHEN 'amil' THEN 'Amil'
      WHEN 'assim' THEN 'ASSIM'
      WHEN 'austral' THEN 'Austral'
      WHEN 'avla' THEN 'Avla'
      WHEN 'axa' THEN 'Axa'
      WHEN 'azul' THEN 'AZUL'
      WHEN 'berkley' THEN 'Berkley'
      WHEN 'bmg' THEN 'BMG'
      WHEN 'bradesco' THEN 'BRADESCO'
      WHEN 'btg' THEN 'BTG'
      WHEN 'caixa' THEN 'CAIXA'
      WHEN 'chubb' THEN 'CHUBB'
      WHEN 'daycoval' THEN 'Daycoval'
      WHEN 'essor' THEN 'Essor'
      WHEN 'estilocorretora' THEN 'ESTILO CORRETORA'
      WHEN 'excelsior' THEN 'EXCELSIOR'
      WHEN 'ezze' THEN 'Ezze'
      WHEN 'fairfax' THEN 'FAIRFAX'
      WHEN 'fator' THEN 'Fator'
      WHEN 'gndi' THEN 'GNDI'
      WHEN 'goldencross' THEN 'GOLDEN CROSS'
      WHEN 'hapvidagndi' THEN 'Hapvida (GNDI)'
      WHEN 'hdi' THEN 'HDI'
      WHEN 'icatu' THEN 'ICATU'
      WHEN 'infinite' THEN 'Infinite'
      WHEN 'inovah' THEN 'INOVAH'
      WHEN 'ita' THEN 'Itaú'
      WHEN 'jns' THEN 'JNS'
      WHEN 'junto' THEN 'Junto'
      WHEN 'kovr' THEN 'Kovr'
      WHEN 'liberty' THEN 'Liberty'
      WHEN 'mapfre' THEN 'MAPFRE'
      WHEN 'mbm' THEN 'MBM'
      WHEN 'medsnior' THEN 'Med Sênior'
      WHEN 'metlife' THEN 'MetLife'
      WHEN 'mitsui' THEN 'Mitsui'
      WHEN 'mongeralaegon' THEN 'MONGERAL AEGON'
      WHEN 'newe' THEN 'Newe'
      WHEN 'neweseguros' THEN 'NEWE SEGUROS'
      WHEN 'now' THEN 'Now'
      WHEN 'odontoprev' THEN 'ODONTOPREV'
      WHEN 'omint' THEN 'OMINT'
      WHEN 'porto' THEN 'Porto'
      WHEN 'portoseguro' THEN 'PORTO SEGURO'
      WHEN 'pottencial' THEN 'POTTENCIAL'
      WHEN 'preventsenior' THEN 'Prevent Senior'
      WHEN 'prudential' THEN 'PRUDENTIAL'
      WHEN 'socristvo' THEN 'SÃO CRISTÓVÃO'
      WHEN 'sombrero' THEN 'Sombrero'
      WHEN 'sompo' THEN 'SOMPO'
      WHEN 'suhai' THEN 'SUHAI'
      WHEN 'swissbradesco' THEN 'Swiss (Bradesco)'
      WHEN 'thinkseg' THEN 'ThinkSeg'
      WHEN 'unimed' THEN 'UNIMED'
      WHEN 'unimedrs' THEN 'UNIMED RS'
      WHEN 'vitaegroup' THEN 'VITAE GROUP'
      WHEN 'zurich' THEN 'Zurich'
      ELSE initcap(btrim(p_seguradora))
    END
  END;
$$;

CREATE OR REPLACE FUNCTION public.lavoro_normaliza_ramo(p_ramo text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_ramo IS NULL OR btrim(p_ramo) = '' THEN NULL
    ELSE CASE regexp_replace(lower(btrim(p_ramo)), '[^a-z0-9]', '', 'g')
      WHEN 'fianalocatcia' THEN 'Fiança Locatícia'
      WHEN 'rcgeral' THEN 'RC Geral'
      WHEN 'acidentespessoais' THEN 'Acidentes Pessoais'
      WHEN 'adiantamentodepagamento' THEN 'Adiantamento de Pagamento'
      WHEN 'aduaneiroadmisso' THEN 'ADUANEIRO - ADMISSÃO'
      WHEN 'anpdescomissionamento' THEN 'ANP - Descomissionamento'
      WHEN 'anppem' THEN 'ANP - PEM'
      WHEN 'auto' THEN 'Auto'
      WHEN 'automvel' THEN 'Automóvel'
      WHEN 'bike' THEN 'Bike'
      WHEN 'capitalizao' THEN 'Capitalização'
      WHEN 'compraevendadeenergia' THEN 'Compra e Venda de Energia'
      WHEN 'condomnio' THEN 'Condomínio'
      WHEN 'consrcio' THEN 'Consórcio'
      WHEN 'dental' THEN 'Dental'
      WHEN 'do' THEN 'D&O'
      WHEN 'dpem' THEN 'DPEM'
      WHEN 'empresarial' THEN 'Empresarial'
      WHEN 'eo' THEN 'E&O'
      WHEN 'equipamentos' THEN 'Equipamentos'
      WHEN 'equipamentosportateis' THEN 'Equipamentos portateis'
      WHEN 'eventos' THEN 'Eventos'
      WHEN 'executanteconcessionrio' THEN 'Executante Concessionário'
      WHEN 'executanteconstrutor' THEN 'Executante Construtor'
      WHEN 'fornecedor' THEN 'Fornecedor'
      WHEN 'garantia' THEN 'Garantia'
      WHEN 'garantiadepagamento' THEN 'Garantia de Pagamento'
      WHEN 'garantiafinanceira' THEN 'GARANTIA FINANCEIRA'
      WHEN 'habitacional' THEN 'Habitacional'
      WHEN 'judicialcvel' THEN 'Judicial Cível'
      WHEN 'judicialfiscal' THEN 'Judicial Fiscal'
      WHEN 'judicialrecursal' THEN 'Judicial Recursal'
      WHEN 'judicialtrabalhista' THEN 'Judicial Trabalhista'
      WHEN 'licitante' THEN 'Licitante'
      WHEN 'manutenocorretiva' THEN 'MANUTENÇÃO CORRETIVA'
      WHEN 'odontolgico' THEN 'Odontológico'
      WHEN 'permutafinanceira' THEN 'Permuta Financeira'
      WHEN 'pet' THEN 'Pet'
      WHEN 'prestadordeservios' THEN 'Prestador de Serviços'
      WHEN 'previdncia' THEN 'Previdência'
      WHEN 'rceventos' THEN 'RC Eventos'
      WHEN 'rcpmdico' THEN 'RCP MÉDICO'
      WHEN 'rcprofissional' THEN 'RC PROFISSIONAL'
      WHEN 'residencial' THEN 'Residencial'
      WHEN 'responsabilidadecivil' THEN 'Responsabilidade civil'
      WHEN 'responsabilidadecivilgeral' THEN 'Responsabilidade Civil Geral'
      WHEN 'riscodeengenharia' THEN 'Risco de Engenharia'
      WHEN 'riscosdeengenharia' THEN 'Riscos de Engenharia'
      WHEN 'riscosdigitaiscyber' THEN 'Riscos Digitais (Cyber)'
      WHEN 'sade' THEN 'Saúde'
      WHEN 'sadedental' THEN 'Saúde + Dental'
      WHEN 'transitoaduaneiro' THEN 'TRANSITO ADUANEIRO'
      WHEN 'transporte' THEN 'Transporte'
      WHEN 'viagem' THEN 'Viagem'
      WHEN 'vida' THEN 'Vida'
      WHEN 'vidaemgrupo' THEN 'Vida em Grupo'
      WHEN 'vidaindividual' THEN 'Vida Individual'
      ELSE btrim(p_ramo)
    END
  END;
$$;

CREATE OR REPLACE VIEW public.vw_lavoro_depara_ramo AS
 SELECT DISTINCT ON ((btrim(lower(ramo)))) ramo,
    CASE WHEN btrim(lower(ramo)) = 'habitacional' THEN 'Demais Ramos'::text ELSE tipo_de_ramo END AS tipo_de_ramo
   FROM raw_lavoro_depara_ramo
  WHERE sync_id = (( SELECT lavoro_sync_log.sync_id
           FROM lavoro_sync_log
          WHERE lavoro_sync_log.base = 'gerencial'::text AND lavoro_sync_log.status = 'sucesso'::text
          ORDER BY lavoro_sync_log.criado_em DESC
         LIMIT 1))
  ORDER BY (btrim(lower(ramo))), id;

CREATE OR REPLACE VIEW public.vw_lavoro_gerencial AS
 SELECT g.id,
    g.grupo,
    g.tomador,
    g.segurado,
    g.documento,
    public.lavoro_normaliza_ramo(g.ramo) AS ramo,
    COALESCE(dp.tipo_de_ramo, 'Sem Categoria'::text) AS tipo_de_ramo,
    public.lavoro_normaliza_seguradora(g.seguradora) AS seguradora,
    g.numero_apolice,
    g.data_emissao,
    g.inicio_vigencia,
    g.fim_vigencia,
    g.valor_is,
    g.premio_total,
    g.percentual_comissao,
    g.comissao_emitida,
    g.qtd_parcelas,
    g.premio_parcela,
    g.comissao_bruta,
    g.imposto_ret,
    g.valor_iss,
    g.valor_recebido_a_receber,
    g.numero_da_parcela,
    g.tipo_pagamento,
    g.empresa_faturada,
    g.data_pagamento,
    COALESCE(EXTRACT(month FROM g.data_emissao)::integer, g.mes) AS mes,
    COALESCE(EXTRACT(year FROM g.data_emissao)::integer, g.ano) AS ano,
    btrim(g.status_parcela_comissao) AS status_parcela_comissao,
    g.possui_repasse,
    g.percentual_repasse,
    g.valor_repasse_total,
    g.data_repasse,
    g.status_repasse,
    g.observacao,
    g.responsavel,
    COALESCE(g.data_emissao, g.inicio_vigencia) AS data_ajustada,
        CASE
            WHEN g.data_pagamento IS NULL THEN NULL::text
            WHEN EXTRACT(day FROM g.data_pagamento) <= 10::numeric THEN '1-10'::text
            WHEN EXTRACT(day FROM g.data_pagamento) <= 20::numeric THEN '11-20'::text
            ELSE '21-31'::text
        END AS dezena,
    g.sync_id
   FROM raw_lavoro_gerencial g
     LEFT JOIN vw_lavoro_depara_ramo dp ON btrim(lower(dp.ramo)) = btrim(lower(g.ramo))
  WHERE g.sync_id = (( SELECT lavoro_sync_log.sync_id
           FROM lavoro_sync_log
          WHERE lavoro_sync_log.base = 'gerencial'::text AND lavoro_sync_log.status = 'sucesso'::text
          ORDER BY lavoro_sync_log.criado_em DESC
         LIMIT 1)) AND lavoro_canal_visivel(COALESCE(dp.tipo_de_ramo, 'Sem Categoria'::text));