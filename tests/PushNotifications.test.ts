import admin from 'firebase-admin'
import jwt from 'jsonwebtoken'

import { PushNotifications } from '../src'
import { fetch } from '../src/fetch'

jest.useFakeTimers()
jest.spyOn(global, 'setInterval')
jest.spyOn(global, 'clearInterval')
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  messaging: jest.fn().mockReturnValue({
    sendEach: jest.fn().mockImplementation((messages) => {
      if (messages[0].token === 'token:error') {
        return { successCount: 0, failureCount: 1, responses: [{ error: new Error('BadErrorErrored') }] }
      }

      return { successCount: 1, failureCount: 0, responses: Array.isArray(messages) ? messages.map(() => ({ messageId: '123' })) : { messageId: '123' } }
    })
  })
}))
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('jwt') }))
jest.mock('../src/fetch', () => ({
  fetch: jest.fn().mockImplementation((host) => {
    if (host.includes('error')) {
      return { status: 400, headers: { 'apns-id': '123' }, body: '{ "reason": "BadDeviceToken" }' }
    }

    return { status: 200, headers: { 'apns-id': '123' }, body: '' }
  })
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe(PushNotifications, (): void => {
  it('initializes firebase if config provided', async (): Promise<void> => {
    const pushNotifications = new PushNotifications({ dryRun: false, firebase: { credentialLocation: './tests/__fixtures__/credentials.json' } })

    pushNotifications.prepare()

    expect(admin.credential.cert).toHaveBeenCalledWith({
      type: 'service_account',
      project_id: 'universal',
      private_key_id: 'some_private_key',
      private_key: '-----BEGIN PRIVATE KEY-----\nrandom\nstuff\nnonetheless\nrandom\nstuff\nnonetheless\n-----END PRIVATE KEY-----\n',
      client_email: 'firebase-adminsdk-mvgse@universal.iam.gserviceaccount.com',
      client_id: '123321',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-mvgse%universal.iam.gserviceaccount.com',
      universe_domain: 'googleapis.com'
    })

    expect(pushNotifications.options).toEqual({
      dryRun: false,
      firebase: {
        credentialLocation: './tests/__fixtures__/credentials.json',
        credential: {
          type: 'service_account',
          projectId: 'universal',
          privateKeyId: 'some_private_key',
          privateKey: '-----BEGIN PRIVATE KEY-----\nrandom\nstuff\nnonetheless\nrandom\nstuff\nnonetheless\n-----END PRIVATE KEY-----\n',
          clientEmail: 'firebase-adminsdk-mvgse@universal.iam.gserviceaccount.com',
          clientId: '123321',
          authUri: 'https://accounts.google.com/o/oauth2/auth',
          tokenUri: 'https://oauth2.googleapis.com/token',
          authProviderX509CertUrl: 'https://www.googleapis.com/oauth2/v1/certs',
          clientX509CertUrl: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-mvgse%universal.iam.gserviceaccount.com',
          universeDomain: 'googleapis.com'
        }
      }
    })

    expect(pushNotifications.capabilities).toEqual(['android'])
  })

  it('initializes apns if config provided and refreshes token constantly', async (): Promise<void> => {
    const pushNotifications = new PushNotifications({
      apns: { p8CertificateLocation: './tests/__fixtures__/apns.p8', teamId: 'test', apnsTopic: 'com.universal.universal', keyId: 'test id' },
      dryRun: false
    })

    pushNotifications.prepare()

    expect(pushNotifications.options).toEqual({
      apns: {
        p8CertificateLocation: './tests/__fixtures__/apns.p8',
        p8Certificate: '-----BEGIN PRIVATE KEY-----\nrandom\nstuff\nnonetheless\n-----END PRIVATE KEY-----',
        teamId: 'test',
        apnsTopic: 'com.universal.universal',
        keyId: 'test id'
      },
      dryRun: false
    })

    expect(jwt.sign).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenCalledTimes(1)

    pushNotifications.release()

    expect(clearInterval).toHaveBeenCalledTimes(1)
    expect(pushNotifications.capabilities).toEqual(['ios'])
  })

  it('initializes both capabilities', async (): Promise<void> => {
    const pushNotifications = new PushNotifications({
      firebase: { credentialLocation: './tests/__fixtures__/credentials.json' },
      dryRun: false,
      apns: { p8CertificateLocation: './tests/__fixtures__/apns.p8', teamId: 'test', apnsTopic: 'com.universal.universal', keyId: 'test id' }
    })

    pushNotifications.prepare()

    expect(pushNotifications.capabilities).toEqual(['android', 'ios'])
  })

  it('emits a warning if no config provided', async (): Promise<void> => {
    const pushNotifications = new PushNotifications({ dryRun: false })
    const warningMock = jest.fn()
    pushNotifications.on('warning', warningMock)

    pushNotifications.prepare()

    expect(pushNotifications.capabilities).toEqual([])
    expect(warningMock).toHaveBeenCalledWith({ event: 'warning', message: 'No capabilities were found. Please check your configuration.' })
  })

  it('pushes notifications for android', async (): Promise<void> => {
    const pushMock = jest.fn()
    const notification = { title: 'test', body: 'test', data: { test: 'test' } }
    const pushNotifications = new PushNotifications({ dryRun: false, firebase: { credentialLocation: './tests/__fixtures__/credentials.json' } })

    pushNotifications.on('push', pushMock)
    pushNotifications.prepare()

    await pushNotifications.pushNotification(['token:token'], notification)

    expect(admin.messaging().sendEach).toHaveBeenCalledWith([
      {
        token: 'token:token',
        notification: { title: 'test', body: 'test' },
        data: { test: 'test' }
      }
    ])
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'android', notification, token: 'token:token' } })

    pushMock.mockClear()

    await pushNotifications.pushNotification(['token:token', 'token:more'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(admin.messaging().sendEach).toHaveBeenLastCalledWith([
      {
        token: 'token:token',
        notification: { title: 'test', body: 'test' },
        data: { test: 'test' }
      },
      {
        token: 'token:more',
        notification: { title: 'test', body: 'test' },
        data: { test: 'test' }
      }
    ])
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'android', notification, token: 'token:token' } })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'android', notification, token: 'token:more' } })
  })

  it('pushes notifications for ios', async (): Promise<void> => {
    const pushMock = jest.fn()
    const notification = { title: 'test', body: 'test', data: { test: 'test' } }
    const pushNotifications = new PushNotifications({
      apns: { p8CertificateLocation: './tests/__fixtures__/apns.p8', teamId: 'test', apnsTopic: 'com.universal.universal', keyId: 'test id' },
      dryRun: false
    })

    pushNotifications.on('push', pushMock)
    pushNotifications.prepare()

    await pushNotifications.pushNotification(['token'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(fetch).toHaveBeenCalledWith('https://api.push.apple.com/3/device/token', {
      body: '{"aps":{"alert":{"title":"test","body":"test"},"sound":"default","badge":1},"test":"test"}',
      headers: { 'apns-topic': 'com.universal.universal', authorization: 'bearer jwt' },
      method: 'POST'
    })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'ios', notification, token: 'token' } })

    pushMock.mockClear()

    await pushNotifications.pushNotification(['more', 'token'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch).toHaveBeenCalledWith('https://api.push.apple.com/3/device/more', {
      body: '{"aps":{"alert":{"title":"test","body":"test"},"sound":"default","badge":1},"test":"test"}',
      headers: { 'apns-topic': 'com.universal.universal', authorization: 'bearer jwt' },
      method: 'POST'
    })
    expect(fetch).toHaveBeenLastCalledWith('https://api.push.apple.com/3/device/token', {
      body: '{"aps":{"alert":{"title":"test","body":"test"},"sound":"default","badge":1},"test":"test"}',
      headers: { 'apns-topic': 'com.universal.universal', authorization: 'bearer jwt' },
      method: 'POST'
    })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'ios', notification, token: 'more' } })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'ios', notification, token: 'token' } })
  })

  it('pushes notifications for both capabilities', async (): Promise<void> => {
    const pushMock = jest.fn()
    const notification = { title: 'test', body: 'test', data: { test: 'test' } }
    const pushNotifications = new PushNotifications({
      apns: { p8CertificateLocation: './tests/__fixtures__/apns.p8', teamId: 'test', apnsTopic: 'com.universal.universal', keyId: 'test id' },
      dryRun: false,
      firebase: { credentialLocation: './tests/__fixtures__/credentials.json' }
    })

    pushNotifications.on('push', pushMock)
    pushNotifications.prepare()

    await pushNotifications.pushNotification(['token:token', 'token'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(admin.messaging().sendEach).toHaveBeenCalledWith([
      {
        token: 'token:token',
        notification: { title: 'test', body: 'test' },
        data: { test: 'test' }
      }
    ])
    expect(fetch).toHaveBeenCalledWith('https://api.push.apple.com/3/device/token', {
      body: '{"aps":{"alert":{"title":"test","body":"test"},"sound":"default","badge":1},"test":"test"}',
      headers: { 'apns-topic': 'com.universal.universal', authorization: 'bearer jwt' },
      method: 'POST'
    })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'android', notification, token: 'token:token' } })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'ios', notification, token: 'token' } })
  })

  it('pushes notifications for both capabilities as dry run', async (): Promise<void> => {
    const pushMock = jest.fn()
    const notification = { title: 'test', body: 'test', data: { test: 'test' } }
    const pushNotifications = new PushNotifications({
      apns: { p8CertificateLocation: './tests/__fixtures__/apns.p8', teamId: 'test', apnsTopic: 'com.universal.universal', keyId: 'test id' },
      dryRun: true,
      firebase: { credentialLocation: './tests/__fixtures__/credentials.json' }
    })

    pushNotifications.on('push', pushMock)
    pushNotifications.prepare()

    await pushNotifications.pushNotification(['token:token', 'token'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(admin.messaging().sendEach).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'android', notification, token: 'token:token' } })
    expect(pushMock).toHaveBeenCalledWith({ event: 'push', payload: { capability: 'ios', notification, token: 'token' } })

    expect(PushNotifications.dryPushes).toEqual([
      {
        instance: expect.any(PushNotifications),
        token: 'token:token',
        notification,
        capability: 'android'
      },
      {
        instance: expect.any(PushNotifications),
        token: 'token',
        notification,
        capability: 'ios'
      }
    ])
  })

  it('emits errors if some tokens are invalid', async (): Promise<void> => {
    const errorMock = jest.fn()
    const pushNotifications = new PushNotifications({
      apns: { p8CertificateLocation: './tests/__fixtures__/apns.p8', teamId: 'test', apnsTopic: 'com.universal.universal', keyId: 'test id' },
      dryRun: false,
      firebase: { credentialLocation: './tests/__fixtures__/credentials.json' }
    })

    pushNotifications.on('error', errorMock)
    pushNotifications.prepare()

    await pushNotifications.pushNotification(['token:error', 'error'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(errorMock).toHaveBeenCalledWith({
      error: new Error('BadErrorErrored'),
      event: 'error',
      payload: { capability: 'android', notification: { body: 'test', data: { test: 'test' }, title: 'test' }, token: 'token:error' }
    })
    expect(errorMock).toHaveBeenCalledWith({
      error: new Error('BadDeviceToken'),
      event: 'error',
      payload: { capability: 'ios', notification: { body: 'test', data: { test: 'test' }, title: 'test' }, token: 'error' }
    })
  })

  it('emits warning if trying to send to a capability not configured', async (): Promise<void> => {
    const warningMock = jest.fn()
    const pushNotifications = new PushNotifications({
      dryRun: false,
      firebase: { credentialLocation: './tests/__fixtures__/credentials.json' }
    })

    pushNotifications.on('warning', warningMock)
    pushNotifications.prepare()

    await pushNotifications.pushNotification(['token:token', 'token'], { title: 'test', body: 'test', data: { test: 'test' } })

    expect(warningMock).toHaveBeenCalledWith({ event: 'warning', message: 'Trying to send an iOS notification, but no iOS capabilities were found.' })
  })
})
