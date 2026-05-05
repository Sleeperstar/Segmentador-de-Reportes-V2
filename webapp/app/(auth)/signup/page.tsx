import Link from "next/link";
import { SignupForm } from "./signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";

export default function SignupPage() {
  return (
    <Card className="shadow-lg border-brand-primary-100">
      <CardHeader className="space-y-4">
        <div className="flex justify-center">
          <BrandLogo className="h-12" />
        </div>
        <div className="text-center space-y-1">
          <CardTitle className="text-xl">Crear cuenta</CardTitle>
          <CardDescription>
            Regístrate para acceder al Segmentador de Reportes.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
