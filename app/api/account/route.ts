import { authErrorResponse, requireUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ user });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Authentication could not be verified." }, { status: 401 });
  }
}
