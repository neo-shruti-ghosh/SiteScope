import { redirect } from "next/navigation";

// The (app) layout sends signed-out visitors on to /login.
export default function Home() {
  redirect("/dashboard");
}
