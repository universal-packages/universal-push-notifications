# Push Notifications

[![npm version](https://badge.fury.io/js/@universal-packages%2Fpush-notifications.svg)](https://www.npmjs.com/package/@universal-packages/push-notifications)
[![Testing](https://github.com/universal-packages/universal-push-notifications/actions/workflows/testing.yml/badge.svg)](https://github.com/universal-packages/universal-push-notifications/actions/workflows/testing.yml)
[![codecov](https://codecov.io/gh/universal-packages/universal-push-notifications/branch/main/graph/badge.svg?token=CXPJSN8IGL)](https://codecov.io/gh/universal-packages/universal-push-notifications)

Push notifications back end sender fro android using firebase and iOS using APNS.

## Install

```shell
npm install @universal-packages/push-notifications
```

## PushNotifications

`PushNotifications` is the main class interface to start sending push notifications the users devices.

```js
import { PushNotifications } from '@universal-packages/push-notifications'

const pushNotifications = new PushNotifications({ firebase: ..., apns: ... })

const token = 'token that came from the user device'

await pushNotifications.pushNotification([token], { title: 'Hello', body: 'World' })

```

### Options

- **`firebase`** `FirebaseOptions`
  Include this if you want capabilities for android devices.
  - **`credentialLocation`** `String`
    The location of the firebase credential file. it looks something like this
    ```json
    {
      "type": "service_account",
      "project_id": "universal",
      "private_key_id": "some_private_key",
      "private_key": "-----BEGIN PRIVATE KEY-----\nrandom\nstuff\nnonetheless\nrandom\nstuff\nnonetheless\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk-mvgse@universal.iam.gserviceaccount.com",
      "client_id": "123321",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-mvgse%universal.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    }
    ```
    Or you can pacify the credential manually.
  - **`credential`** `Credential`
    The credential object.
    - **`type`** `String`
    - **`projectId`** `String`
    - **`privateKeyId`** `String`
    - **`privateKey`** `String`
    - **`clientEmail`** `String`
    - **`clientId`** `String`
    - **`authUri`** `String`
    - **`tokenUri`** `String`
    - **`authProviderX509CertUrl`** `String`
    - **`clientX509CertUrl`** `String`
    - **`universeDomain`** `String`
- **`apns`** `ApnsOptions`
  Include this if you want capabilities for iOS devices.
  - **`p8CertificateLocation`** `String`
    The location of the p8 certificate file. Or you can pass the certificate manually.
  - **`p8Certificate`** `String`
    The p8 certificate.
  - **`teamId`** `String`
    The team id of you apple developer account used to generate the p8 certificate.
  - **`keyId`** `String`
    The key id of you apple developer account used to generate the p8 certificate.
  - **`sandbox`** `Boolean`
    Whether to use the sandbox environment or not.
  - **`apnsTopic`** `String`
    The bundle id of your app.

### Instance methods

#### **`prepare()`** **`async`**

Prepares the instance to start sending push notifications.

#### **`release()`** **`async`**

Releases any resources used by the instance.

#### **`pushNotifications(tokens: String[], notification: Object)`**

- **`tokens`** `String[]`
  The tokens of the devices you want to send the notification to.
- **`notification`** `Object`
  The notification object.
  - **`title`** `String`
    The title of the notification.
  - **`body`** `String`
    The body of the notification.
  - **`data`** `Object`
    The data to be sent with the notification.

Sends the notifications to all devices, tokens can come from any android or iOS device.

## Typescript

This library is developed in TypeScript and shipped fully typed.

## Contributing

The development of this library happens in the open on GitHub, and we are grateful to the community for contributing bugfixes and improvements. Read below to learn how you can take part in improving this library.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributing Guide](./CONTRIBUTING.md)

### License

[MIT licensed](./LICENSE).
