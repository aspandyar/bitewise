import { getSessionUserId } from "@/lib/auth/session";
import { RequestUserMark } from "./request-user";

export async function RequestUser() {
  return <RequestUserMark userId={await getSessionUserId()} />;
}
