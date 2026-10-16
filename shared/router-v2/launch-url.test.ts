/// <reference types="jest" />
const mockGetInitialURL = jest.fn<Promise<string | null>, []>()
jest.mock('react-native', () => ({Linking: {getInitialURL: async () => mockGetInitialURL()}}))

beforeEach(() => {
  jest.resetModules()
  mockGetInitialURL.mockReset()
})

const load = async () => (await import('./launch-url')).takeLaunchURL

test('the launch url is handed out once, so a navigator mounting again does not replay it', async () => {
  mockGetInitialURL.mockResolvedValue('keybase://incoming-share/0000ab')
  const takeLaunchURL = await load()

  await expect(takeLaunchURL()).resolves.toBe('keybase://incoming-share/0000ab')
  await expect(takeLaunchURL()).resolves.toBeUndefined()
  expect(mockGetInitialURL).toHaveBeenCalledTimes(1)
})

test('no launch url, or a failed read, is undefined', async () => {
  mockGetInitialURL.mockResolvedValue(null)
  await expect((await load())()).resolves.toBeUndefined()

  mockGetInitialURL.mockRejectedValue(new Error('no'))
  await expect((await load())()).resolves.toBeUndefined()
})

test('a launch url the caller turns down stays for the next caller', async () => {
  mockGetInitialURL.mockResolvedValue('keybase://convid/0000ab')
  const takeLaunchURL = await load()
  const onlyShares = (url: string) => url.startsWith('keybase://incoming-share')

  await expect(takeLaunchURL(onlyShares)).resolves.toBeUndefined()
  await expect(takeLaunchURL()).resolves.toBe('keybase://convid/0000ab')
  await expect(takeLaunchURL()).resolves.toBeUndefined()
})

test('a launch url the caller accepts is gone for the next caller', async () => {
  mockGetInitialURL.mockResolvedValue('keybase://incoming-share')
  const takeLaunchURL = await load()

  await expect(takeLaunchURL(url => url.startsWith('keybase://incoming-share'))).resolves.toBe(
    'keybase://incoming-share'
  )
  await expect(takeLaunchURL()).resolves.toBeUndefined()
})

test('two callers racing for the launch url do not both get it', async () => {
  mockGetInitialURL.mockResolvedValue('keybase://incoming-share')
  const takeLaunchURL = await load()

  const got = await Promise.all([takeLaunchURL(), takeLaunchURL()])
  expect(got.filter(Boolean)).toHaveLength(1)
})
