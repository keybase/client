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
