function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  TELEGRAM_BOT_TOKEN: req("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_WEBHOOK_SECRET: req("TELEGRAM_WEBHOOK_SECRET"),
  TELEGRAM_BIND_TOKEN_SECRET: req("TELEGRAM_BIND_TOKEN_SECRET"),
  PUBLIC_BOT_USERNAME: req("PUBLIC_BOT_USERNAME"),
  PUBLIC_BOT_URL: req("PUBLIC_BOT_URL"),
  SUPABASE_URL: req("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: req("SUPABASE_SERVICE_ROLE_KEY"),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "https://www.waydora.com",
  API_SERVER_URL: req("API_SERVER_URL"),
  WEATHER_API_KEY: process.env.WEATHER_API_KEY ?? "",
  PORT: Number(process.env.PORT ?? 3000),
};
