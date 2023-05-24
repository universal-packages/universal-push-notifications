import { fetch } from '../src/fetch'

jest.mock('http2', () => ({
  connect: jest.fn().mockReturnValue({
    on: jest.fn(),
    request: jest.fn().mockReturnValue({
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'response') {
          callback({ ':status': 200 })
        }

        if (event === 'data') {
          callback('data')
        }

        if (event === 'end') {
          callback()
        }
      }),
      setEncoding: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    }),
    close: jest.fn()
  })
}))

describe('fetch', (): void => {
  it('does http2 stuff', async (): Promise<void> => {
    const response = await fetch('https://example.com', { method: 'POST', headers: { extra: 'header' }, body: 'body' })

    expect(response).toEqual({ status: 200, body: 'data', headers: { ':status': 200 } })
  })
})
