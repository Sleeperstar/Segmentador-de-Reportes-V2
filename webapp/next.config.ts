import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acceder al servidor de dev desde la IP local de la red (ej: otro
  // dispositivo en la misma red o al abrir la app desde la IP en lugar de localhost).
  // Solo afecta al servidor de desarrollo; en producción no tiene efecto.
  allowedDevOrigins: ["192.168.18.23"],
};

export default nextConfig;
