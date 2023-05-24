import http2 from 'http2'

export interface FetchOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

export interface Response {
  status: number
  headers: Record<string, any>
  body: string
}

export function fetch(url: string, options: FetchOptions): Promise<Response> {
  return new Promise((resolve, reject) => {
    const scheme = url.startsWith('https') ? 'https' : 'http'
    const host = url.replace(`${scheme}://`, '').split('/')[0]
    const path = url.replace(`${scheme}://${host}`, '')
    const headers = { ':method': options.method, ':scheme': scheme, ':path': path, ...options.headers }
    const client = http2.connect(`${scheme}://${host}`)

    client.on('error', reject)

    const request = client.request(headers)

    let responseData: any = ''
    let responseHeaders: any
    let responseStatus: number

    request.on('response', (headers) => {
      responseHeaders = headers
      responseStatus = headers[':status']
    })

    request.on('data', (chunk) => {
      responseData += chunk
    })

    request.on('end', () => {
      client.close()

      resolve({ status: responseStatus, headers: responseHeaders, body: responseData ? responseData.toString('utf8') : undefined })
    })

    if (options.body) {
      request.setEncoding('utf8')
      request.write(options.body)
    }

    request.end()
  })
}
