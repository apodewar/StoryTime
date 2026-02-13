import AuthForm from "../../../components/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-slate-600">Log in to keep writing.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <AuthForm defaultAction="login" />
      </div>

      <p className="text-center text-sm text-slate-600">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-slate-900">
          Sign up
        </Link>
      </p>
    </div>
  );
}
