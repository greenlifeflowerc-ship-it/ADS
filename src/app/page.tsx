import { redirect } from "next/navigation";

// The dashboard is the home surface; middleware bounces unauthenticated users
// to /login.
export default function Home() {
  redirect("/dashboard");
}
