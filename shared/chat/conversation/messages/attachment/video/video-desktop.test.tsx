/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import VideoImpl from './videoimpl'

const message = Message.makeMessageAttachment({
  attachmentType: 'image',
  author: 'testuser',
  fileURL: 'http://127.0.0.1/file?id=1',
  id: T.Chat.numberToMessageID(10),
  ordinal: T.Chat.numberToOrdinal(10),
  previewHeight: 100,
  previewURL: 'http://127.0.0.1/preview?id=1',
  previewWidth: 200,
  videoDuration: '0:05',
})

const renderVideo = (openFullscreen?: () => void) =>
  render(<VideoImpl allowPlay={true} message={message} openFullscreen={openFullscreen} />)

const video = () => document.querySelector('video')
const fullscreenButton = () => screen.queryByTestId('video-fullscreen')

afterEach(cleanup)

test('the poster plays the video inline, once', () => {
  renderVideo(jest.fn())
  expect(video()).toBeNull()

  fireEvent.click(screen.getByText('0:05'))

  expect(video()).not.toBeNull()
  expect(video()?.loop).toBe(false)
})

test('the fullscreen button on the poster opens fullscreen without playing inline', () => {
  const openFullscreen = jest.fn()
  renderVideo(openFullscreen)

  fireEvent.click(fullscreenButton()!)

  expect(openFullscreen).toHaveBeenCalledTimes(1)
  expect(video()).toBeNull()
})

test('the fullscreen button over the playing video opens fullscreen and stops the inline one', () => {
  const openFullscreen = jest.fn()
  renderVideo(openFullscreen)
  fireEvent.click(screen.getByText('0:05'))

  fireEvent.click(fullscreenButton()!)

  expect(openFullscreen).toHaveBeenCalledTimes(1)
  expect(video()).toBeNull()
})

test('a click on the playing video is left to its controls', () => {
  const openFullscreen = jest.fn()
  renderVideo(openFullscreen)
  fireEvent.click(screen.getByText('0:05'))

  fireEvent.click(video()!)
  fireEvent.doubleClick(video()!)

  expect(openFullscreen).not.toHaveBeenCalled()
  expect(video()).not.toBeNull()
})

test('no fullscreen button until the message is sent', () => {
  renderVideo(undefined)
  expect(fullscreenButton()).toBeNull()
})
