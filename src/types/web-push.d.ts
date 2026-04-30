declare module 'web-push' {
  interface PushSubscription {
    endpoint: string
    keys?: { p256dh: string; auth: string }
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer,
    options?: object
  ): Promise<{ statusCode: number; body: string; headers: object }>

  export { setVapidDetails, sendNotification }
}
