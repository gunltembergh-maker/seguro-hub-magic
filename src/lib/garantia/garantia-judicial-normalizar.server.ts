// Ponte server-only para o normalizador da consulta de mercado.
//
// A lógica pura vive em ./garantia-judicial-normalizar.ts, para que a tela
// (Garantia → Formulário Admin) leia exatamente o mesmo resultado que vai na
// planilha e no e-mail. Este arquivo só reexporta — nenhuma regra aqui.
export * from "./garantia-judicial-normalizar";
