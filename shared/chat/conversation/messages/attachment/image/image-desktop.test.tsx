/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, fireEvent, render} from '@testing-library/react'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import ImageImpl from './imageimpl'

const messageWith = (previewURL: string) =>
  Message.makeMessageAttachment({
    attachmentType: 'image',
    author: 'testuser',
    fileURL: 'http://127.0.0.1/file?id=1',
    id: T.Chat.numberToMessageID(10),
    ordinal: T.Chat.numberToOrdinal(10),
    previewHeight: 100,
    previewURL,
    previewWidth: 200,
  })

const image = () => document.querySelector('img')

afterEach(cleanup)

test('a preview that fails to load is hidden, and a new URL is tried again', () => {
  const {rerender} = render(<ImageImpl message={messageWith('http://127.0.0.1/at?key=a')} />)
  expect(image()?.getAttribute('src')).toBe('http://127.0.0.1/at?key=a')

  fireEvent.error(image()!)
  expect(image()).toBeNull()

  rerender(<ImageImpl message={messageWith('http://127.0.0.1/at?key=b')} />)
  expect(image()?.getAttribute('src')).toBe('http://127.0.0.1/at?key=b')
})
