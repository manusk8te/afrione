const configuredSeconds = Number(process.env.NEXT_PUBLIC_DISPATCH_TIMEOUT_SECONDS)

export const DISPATCH_TIMEOUT_SECONDS =
  Number.isInteger(configuredSeconds) && configuredSeconds >= 30 && configuredSeconds <= 300
    ? configuredSeconds
    : 120
