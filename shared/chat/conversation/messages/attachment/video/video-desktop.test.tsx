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

// Fullscreen is the player's own control: no corner button, and a double-click is left to Chromium.
test('the playing video offers its own fullscreen control', () => {
  renderVideo(jest.fn())
  expect(fullscreenButton()).toBeNull()
  fireEvent.click(screen.getByText('0:05'))

  expect(fullscreenButton()).toBeNull()
  expect(video()?.getAttribute('controlsList')).not.toMatch(/nofullscreen/)
})

test('a double-click on the playing video does not open the attachment view', () => {
  const openFullscreen = jest.fn()
  renderVideo(openFullscreen)
  fireEvent.click(screen.getByText('0:05'))

  fireEvent.doubleClick(video()!)

  expect(openFullscreen).not.toHaveBeenCalled()
  expect(video()).not.toBeNull()
})
