// The pasteboard read-back of setPasteboard (gate/device.ts), kept apart so it can be unit-tested.
import {isAttemptOver} from './attempt-binding-lib'

// Whether the pasteboard, read by `read` (base64, as WDA's mobile: getPasteboard answers), holds
// `text`: true, or undefined for a waitFor to poll again. A failed read throws only that it failed:
// a WebDriver error may echo what it read, and the text can be a secret (an invite link) that must
// not reach the waitFor's timeout message.
export const pasteboardHolds = async (read: () => Promise<string>, text: string): Promise<true | undefined> => {
  let got: string
  try {
    got = await read()
  } catch (e) {
    if (isAttemptOver(e)) throw e
    // no cause: its message may hold the pasteboard's text
    // eslint-disable-next-line preserve-caught-error
    throw new Error('reading the pasteboard back failed')
  }
  return Buffer.from(got, 'base64').toString('utf8') === text ? true : undefined
}
