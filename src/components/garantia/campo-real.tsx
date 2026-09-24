// Campo de dinheiro em real (R$ 1.234,56). Tudo no Hub é em real: não há seletor de moeda.
// A digitação entra como centavos, então o valor mostrado já sai mascarado.

import { Input } from "@/components/ui/input";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CampoReal({
  valor,
  onChange,
  id,
  placeholder = "R$ 0,00",
  disabled,
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder}
      disabled={disabled}
      value={valor == null ? "" : fmt(valor)}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D+/g, "");
        onChange(digitos ? Number(digitos) / 100 : null);
      }}
    />
  );
}
