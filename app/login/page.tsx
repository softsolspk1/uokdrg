import Image from "next/image";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-uok-700 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.18),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(211,34,77,0.35),transparent_50%)]" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-lg bg-white p-1.5">
            <Image src="/uok-logo.png" alt="University of Karachi" width={40} height={48} />
          </div>
          <div>
            <div className="font-serif text-lg font-bold">University of Karachi</div>
            <div className="text-xs tracking-widest text-uok-100 uppercase">Office of the Deputy Registrar (General)</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <div className="mb-4 h-1 w-14 rounded bg-gold" />
          <h1 className="font-serif text-4xl leading-tight font-bold">Human Resource Management System</h1>
          <p className="mt-4 text-uok-100">
            Employee records, administrative charges, sanctioned posts, vacancies, retirements and personnel documents — in one place.
          </p>
        </div>
        <div className="relative text-xs text-uok-200">University Road, Karachi-75270 · uok.edu.pk</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Image src="/uok-logo.png" alt="University of Karachi" width={72} height={86} />
            <div className="mt-2 font-serif text-lg font-bold text-uok-700">University of Karachi</div>
          </div>
          <h2 className="font-serif text-2xl font-bold text-navy">Sign in</h2>
          <p className="mt-1 mb-6 text-sm text-muted">Use your HRM account to continue.</p>
          <LoginForm />
          <p className="mt-10 text-center text-xs text-muted">
            Developed by <a href="https://softsols.pk/" target="_blank" rel="noopener noreferrer" className="font-medium text-uok-700 hover:underline">Softsols Pakistan</a>
          </p>
        </div>
      </div>
    </div>
  );
}
