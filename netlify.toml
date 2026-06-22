[build]
  functions = "netlify/functions"

[build.environment]
  SECRETS_SCAN_ENABLED = "false"
  SECRETS_SCAN_OMIT_KEYS = "STRIPE_SECRET_KEY"

[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
