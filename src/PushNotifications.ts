import { checkFile } from '@universal-packages/fs-utils'
import EventEmitter from 'events'
import admin from 'firebase-admin'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import { Capability, PushNotification, PushNotificationsOptions } from './PushNotifications.types'
import { fetch } from './fetch'

export default class PushNotifications extends EventEmitter {
  public readonly options: PushNotificationsOptions
  public readonly capabilities: Capability[] = []

  private apnsToken: string
  private refreshApnsTokenInterval: NodeJS.Timeout

  public constructor(options?: PushNotificationsOptions) {
    super()
    this.options = { ...options }
  }

  public prepare(): void {
    if (this.options.firebase?.credentialLocation || this.options.firebase?.credential) this.prepareFirebase()
    if (this.options.apns?.p8CertificateLocation || this.options.apns?.p8Certificate) this.prepareApns()

    if (this.capabilities.length === 0) {
      this.emit('warning', 'No capabilities were found. Please check your configuration.')
    }
  }

  public async release(): Promise<void> {
    if (this.refreshApnsTokenInterval) {
      clearInterval(this.refreshApnsTokenInterval)
    }
  }

  public async pushNotification(deviceToken: string[], notification: PushNotification): Promise<any> {
    const androidTokens = []
    const iosTokens = []

    for (let i = 0; i < deviceToken.length; i++) {
      if (deviceToken[i].includes(':')) {
        androidTokens.push(deviceToken[i])
      } else {
        iosTokens.push(deviceToken[i])
      }
    }

    let androidResult: string[] = []
    let iosResult: string[] = []

    if (androidTokens.length > 0) {
      if (this.capabilities.includes('android')) {
        androidResult = await this.sendAndroidNotification(androidTokens, notification)
      } else {
        this.emit('warning', 'Trying to send an Android notification, but no Android capabilities were found.')
      }
    }
    if (iosTokens.length > 0) {
      if (this.capabilities.includes('ios')) {
        iosResult = await this.sendIosNotification(iosTokens, notification)
      } else {
        this.emit('warning', 'Trying to send an iOS notification, but no iOS capabilities were found.')
      }
    }

    return [...androidResult, ...iosResult]
  }

  private async prepareFirebase(): Promise<void> {
    if (this.options.firebase?.credentialLocation) {
      const finalLocation = checkFile(this.options.firebase.credentialLocation)
      const certificate = fs.readFileSync(finalLocation)
      const parsedCertificate = JSON.parse(certificate.toString())

      this.options.firebase.credential = {
        type: parsedCertificate.type,
        projectId: parsedCertificate.project_id,
        privateKeyId: parsedCertificate.private_key_id,
        privateKey: parsedCertificate.private_key,
        clientEmail: parsedCertificate.client_email,
        clientId: parsedCertificate.client_id,
        authUri: parsedCertificate.auth_uri,
        tokenUri: parsedCertificate.token_uri,
        authProviderX509CertUrl: parsedCertificate.auth_provider_x509_cert_url,
        clientX509CertUrl: parsedCertificate.client_x509_cert_url,
        universeDomain: parsedCertificate.universe_domain
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        type: this.options.firebase.credential.type as any,
        project_id: this.options.firebase.credential.projectId,
        private_key_id: this.options.firebase.credential.privateKeyId,
        private_key: this.options.firebase.credential.privateKey,
        client_email: this.options.firebase.credential.clientEmail,
        client_id: this.options.firebase.credential.clientId,
        auth_uri: this.options.firebase.credential.authUri,
        token_uri: this.options.firebase.credential.tokenUri,
        auth_provider_x509_cert_url: this.options.firebase.credential.authProviderX509CertUrl,
        client_x509_cert_url: this.options.firebase.credential.clientX509CertUrl,
        universe_domain: this.options.firebase.credential.universeDomain
      } as any)
    })
    this.capabilities.push('android')
  }

  private prepareApns(): void {
    if (this.options.apns?.p8CertificateLocation) {
      const finalLocation = checkFile(this.options.apns?.p8CertificateLocation)

      this.options.apns.p8Certificate = fs.readFileSync(finalLocation, 'utf8')
    }

    this.refreshApnsToken()

    this.refreshApnsTokenInterval = setInterval(() => {
      this.refreshApnsToken()
    }, 1000 * 60 * 50)

    this.capabilities.push('ios')
  }

  private refreshApnsToken(): void {
    const payload = { iss: this.options.apns.teamId, iat: Date.now() / 1000 }
    const headers = { header: { alg: 'ES256', kid: this.options.apns.keyId } }

    this.apnsToken = jwt.sign(payload, this.options.apns.p8Certificate, headers)
  }

  private async sendAndroidNotification(deviceTokens: string[], notification: PushNotification): Promise<any> {
    const messages = []

    for (let i = 0; i < deviceTokens.length; i++) {
      messages.push({
        token: deviceTokens[i],
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data
      })
    }

    const result = await admin.messaging().sendEach(messages)

    for (let i = 0; i < result.responses.length; i++) {
      const response = result.responses[i]

      if (response.error) {
        this.emit('error', `Failed to send Android notification to ${messages[i].token}: ${response.error}`)
      }
    }

    return result.responses.map((response) => response.messageId).filter(Boolean)
  }

  private async sendIosNotification(deviceTokens: string[], notification: PushNotification): Promise<any> {
    const host = this.options.apns.sandbox ? 'https://api.sandbox.push.apple.com/3/device/' : 'https://api.push.apple.com/3/device/'
    const ids = []

    for (let i = 0; i < deviceTokens.length; i++) {
      const token = deviceTokens[i]

      const message = {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body
          },
          sound: 'default',
          badge: 1
        },
        ...notification.data
      }

      const response = await fetch(`${host}${token}`, {
        method: 'POST',
        headers: {
          'apns-topic': this.options.apns.apnsTopic,
          authorization: `bearer ${this.apnsToken}`
        },
        body: JSON.stringify(message)
      })

      const apnsId = response.headers['apns-id']

      if (response.status !== 200) {
        const error: any = JSON.parse(response.body)

        this.emit('error', `Failed to send iOS notification to ${token}: ${error.reason}`)
      }

      ids.push(apnsId)
    }

    return ids
  }
}
