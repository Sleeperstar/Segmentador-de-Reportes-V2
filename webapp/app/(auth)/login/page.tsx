import Link from "next/link";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  return (
    <Card className="shadow-lg border-brand-primary-100">
      <CardHeader className="space-y-4">
        <div className="flex justify-center">
          <BrandLogo className="h-12" />
        </div>
        <div className="text-center space-y-1">
          <CardTitle className="text-xl">Bienvenido de vuelta</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al segmentador.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <LoginForm searchParamsPromise={searchParams} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Aún no tienes cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            Crear una cuenta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
