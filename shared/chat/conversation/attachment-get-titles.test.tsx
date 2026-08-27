/** @jest-environment jsdom */
/// <reference types="jest" />
import {isKbfsPath, pathToAttachmentType} from './attachment-get-titles'

describe('pathToAttachmentType', () => {
  test('common image extensions preview as images, case insensitively', () => {
    for (const path of ['/tmp/a.jpg', '/tmp/a.JPEG', '/tmp/a.png', '/tmp/a.gif', '/tmp/a.bmp']) {
      expect(pathToAttachmentType(path)).toBe('image')
    }
  })

  test('videos preview as video', () => {
    expect(pathToAttachmentType('/tmp/a.mp4')).toBe('video')
    expect(pathToAttachmentType('/tmp/a.mov')).toBe('video')
  })

  test('everything else previews as a file', () => {
    // heic is deliberately a file here even though it is processed like an image
    expect(pathToAttachmentType('/tmp/a.heic')).toBe('file')
    expect(pathToAttachmentType('/tmp/a.pdf')).toBe('file')
    expect(pathToAttachmentType('/tmp/noextension')).toBe('file')
  })

  test('the extension has to be on the file name, not the directory', () => {
    expect(pathToAttachmentType('/tmp/a.png/notanimage')).toBe('file')
  })
})

describe('isKbfsPath', () => {
  test('only /keybase/ paths count', () => {
    expect(isKbfsPath('/keybase/private/testuser/a.png')).toBe(true)
    expect(isKbfsPath('/tmp/a.png')).toBe(false)
    expect(isKbfsPath('keybase/private/testuser/a.png')).toBe(false)
  })
})
