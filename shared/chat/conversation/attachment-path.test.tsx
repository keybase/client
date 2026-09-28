/// <reference types="jest" />
import {isKbfsPath, toAttachmentPath} from './attachment-path'

describe('isKbfsPath', () => {
  test('only /keybase/ paths count', () => {
    expect(isKbfsPath('/keybase/private/testuser/a.png')).toBe(true)
    expect(isKbfsPath('/tmp/a.png')).toBe(false)
    expect(isKbfsPath('keybase/private/testuser/a.png')).toBe(false)
  })
})

describe('toAttachmentPath on mobile', () => {
  const originalIsMobile = global.isMobile
  beforeAll(() => {
    global.isMobile = true
  })
  afterAll(() => {
    global.isMobile = originalIsMobile
  })

  test('local paths get the file scheme', () => {
    expect(toAttachmentPath('/tmp/a.png')).toBe('file:///tmp/a.png')
  })

  // A file:// kbfs path no longer reads as kbfs, so it would be handed to the
  // native media processor as a local file that doesn't exist.
  test('kbfs paths stay kbfs paths', () => {
    const p = '/keybase/private/testuser,testuser-mac/a.jpeg'
    expect(toAttachmentPath(p)).toBe(p)
    expect(isKbfsPath(toAttachmentPath(p))).toBe(true)
  })
})
