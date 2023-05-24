export type Capability = 'ios' | 'android'

export interface PushNotificationsOptions {
  firebase?: {
    credentialLocation?: string
    credential?: {
      type: string
      projectId: string
      privateKeyId: string
      privateKey: string
      clientEmail: string
      clientId: string
      authUri: string
      tokenUri: string
      authProviderX509CertUrl: string
      clientX509CertUrl: string
      universeDomain: string
    }
  }
  apns?: {
    p8CertificateLocation?: string
    p8Certificate?: string
    teamId: string
    keyId: string
    sandbox?: boolean
    apnsTopic: string
  }
}

export interface PushNotification {
  title: string
  body: string
  data?: Record<string, any>
}
