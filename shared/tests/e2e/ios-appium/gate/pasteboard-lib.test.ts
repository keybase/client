import {pasteboardHolds} from './pasteboard-lib'

const LINK = 'https://keybase.io/team/invite/e2e-secret-0123456789abcdef'
const b64 = (s: string) => Buffer.from(s).toString('base64')

test('the pasteboard holding the text reads true, any other text undefined', async () => {
  await expect(pasteboardHolds(async () => Promise.resolve(b64(LINK)), LINK)).resolves.toBe(true)
  await expect(pasteboardHolds(async () => Promise.resolve(b64('filler')), LINK)).resolves.toBeUndefined()
})

test('a failed read says only that it failed, never what the error echoed', async () => {
  const read = async () => Promise.reject(new Error(`WebDriverError: unexpected pasteboard ${LINK}`))
  const err = await pasteboardHolds(read, LINK).then(
    () => undefined,
    (e: unknown) => e as Error
  )
  expect(err?.message).toBe('reading the pasteboard back failed')
  expect(JSON.stringify(err)).not.toContain('e2e-secret')
  expect(err?.cause).toBeUndefined()
})
