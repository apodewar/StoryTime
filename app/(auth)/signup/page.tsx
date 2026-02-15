import AuthForm from "../../../components/AuthForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-slate-600">Start writing and sharing today.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <AuthForm defaultAction="signup" />
      </div>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-900">
          Log in
        </Link>
      </p>
      <p className="text-center text-sm text-slate-600">
        <Link href="/algo" className="font-medium text-slate-900">
          Continue as guest
        </Link>
      </p>
    </div>
  );
}
