"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type InputProps = React.ComponentProps<typeof Input>;

/**
 * Input controlado para arreglos de strings separados por coma.
 *
 * El problema con el patrón habitual (parsear en onChange + reconstruir con
 * join) es que al presionar "," se dispara el onChange, el item vacío se elimina
 * con filter(Boolean) y la coma desaparece del campo.
 *
 * Solución: el texto crudo se mantiene en estado local mientras el campo tiene
 * el foco. El parseo solo ocurre en onBlur, cuando el usuario termina de
 * escribir. Al recibir foco se muestra el texto tal cual; al perder el foco se
 * normaliza (trim + filter de vacíos).
 */
export function CommaSeparatedInput({
  value,
  onChange,
  ...rest
}: Omit<InputProps, "value" | "onChange"> & {
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const [raw, setRaw] = useState(() => value.join(", "));
  const focused = useRef(false);

  // Sincronizar desde el prop cuando el campo no está activo (ej: reset externo).
  useEffect(() => {
    if (!focused.current) {
      setRaw(value.join(", "));
    }
  }, [value]);

  function handleBlur() {
    focused.current = false;
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(parsed);
    setRaw(parsed.join(", "));
  }

  return (
    <Input
      {...rest}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={handleBlur}
    />
  );
}
