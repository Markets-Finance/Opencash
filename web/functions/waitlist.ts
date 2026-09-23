interface WaitlistEnv {
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): { run(): Promise<unknown> };
    };
  };
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export async function onRequestPost(context: {
  request: Request;
  env: WaitlistEnv;
}) {
  let email: unknown;
  try {
    ({ email } = (await context.request.json()) as { email?: unknown });
  } catch {
    return Response.json({ error: "Malformed request" }, { status: 400 });
  }

  if (typeof email !== "string" || email.length > 254 || !EMAIL.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  try {
    await context.env.DB.prepare(
      "INSERT INTO waitlist (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING",
    )
      .bind(email.trim().toLowerCase(), new Date().toISOString())
      .run();
  } catch {
    return Response.json({ error: "Could not save that right now" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
