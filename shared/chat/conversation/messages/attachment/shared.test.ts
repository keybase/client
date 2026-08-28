/// <reference types="jest" />
import type * as T from '@/constants/types'
import {makeMessageAttachment} from '@/constants/chat/message'
import {
  getAttachmentDisplayFileName,
  getAttachmentPreviewSize,
  maxHeight,
  maxWidth,
  messageAttachmentHasProgress,
} from './shared'

const attachment = (override?: Partial<T.Chat.MessageAttachment>) => makeMessageAttachment(override)

describe('messageAttachmentHasProgress', () => {
  test('true while bytes are actually moving', () => {
    expect(messageAttachmentHasProgress('uploading')).toBe(true)
    expect(messageAttachmentHasProgress('downloading')).toBe(true)
  })

  test('false when idle or when the server is doing the work', () => {
    expect(messageAttachmentHasProgress(undefined)).toBe(false)
    // the client has no byte counts for these two
    expect(messageAttachmentHasProgress('remoteUploading')).toBe(false)
    expect(messageAttachmentHasProgress('mobileSaving')).toBe(false)
  })
})

describe('getAttachmentDisplayFileName', () => {
  test('desktop uploads keep their filename', () => {
    expect(getAttachmentDisplayFileName(attachment({deviceType: 'desktop', fileName: 'cat.png'}))).toBe(
      'cat.png'
    )
  })

  test('mobile uploads get a generic name by media kind', () => {
    expect(
      getAttachmentDisplayFileName(
        attachment({deviceType: 'mobile', fileName: 'IMG_0001.HEIC', inlineVideoPlayable: false})
      )
    ).toBe('Image from mobile')
    expect(
      getAttachmentDisplayFileName(attachment({deviceType: 'mobile', inlineVideoPlayable: true}))
    ).toBe('Video from mobile')
  })
})

describe('getAttachmentPreviewSize', () => {
  test('small previews are used as-is', () => {
    const {height, width} = getAttachmentPreviewSize(attachment({previewHeight: 100, previewWidth: 200}))
    expect({height, width}).toEqual({height: 100, width: 200})
  })

  test('wide previews are clamped to the max width, keeping the aspect ratio', () => {
    const {height, width} = getAttachmentPreviewSize(
      attachment({previewHeight: maxWidth, previewWidth: maxWidth * 2})
    )
    expect(width).toBe(maxWidth)
    expect(height).toBe(Math.ceil(maxWidth / 2))
  })

  test('tall previews are clamped to the max height', () => {
    const {height, width} = getAttachmentPreviewSize(
      attachment({previewHeight: maxHeight * 2, previewWidth: maxHeight})
    )
    expect(height).toBe(maxHeight)
    expect(width).toBe(Math.ceil(maxHeight / 2))
  })

  test('unmeasurable previews collapse to zero unless the square fallback is asked for', () => {
    const heic = attachment({previewHeight: 0, previewWidth: 0})
    expect(getAttachmentPreviewSize(heic)).toEqual({height: 0, previewURL: '', width: 0})
    const {height, width} = getAttachmentPreviewSize(heic, true)
    expect({height, width}).toEqual({height: 320, width: 320})
  })

  test('falls back to the full file url when there is no preview url', () => {
    expect(getAttachmentPreviewSize(attachment({fileURL: 'file://full'})).previewURL).toBe('file://full')
    expect(
      getAttachmentPreviewSize(attachment({fileURL: 'file://full', previewURL: 'file://preview'})).previewURL
    ).toBe('file://preview')
  })
})
