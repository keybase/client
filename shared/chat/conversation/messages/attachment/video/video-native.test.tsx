/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as RTL from '@testing-library/react'
import type * as MessageModule from '@/constants/chat/message'
import type * as T from '@/constants/types'
import type * as VideoImplModule from './videoimpl'

// videoimpl picks its native half when it loads, so the platform globals flip before any require.
// isIOS stays off: the iOS theme needs DynamicColorIOS, which the react-native test stub lacks.
const g = globalThis as unknown as {isElectron: boolean; isIOS: boolean; isMobile: boolean}
g.isMobile = true
g.isIOS = false
g.isElectron = false

type HostProps = {children?: unknown; onLongPress?: () => void; onPress?: () => void; testID?: string}
let mockPressables: Array<HostProps> = []
type FakePlayer = {loop: boolean; pause: jest.Mock; play: jest.Mock; replay: jest.Mock}
let mockPlayers: Array<FakePlayer> = []
let mockPlayerListeners: Array<{event: string; listener: () => void}> = []
let mockPlayerReleased = false
let mockMountedVideoViews = 0

jest.mock('react-native', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native')
  const mockHost = (p: HostProps) => {
    if (p.onPress) mockPressables.push(p)
    return typeof p.children === 'function' ? null : (p.children ?? null)
  }
  return {
    ...actual,
    Image: mockHost,
    Keyboard: {dismiss: () => {}},
    Pressable: mockHost,
    Text: mockHost,
    View: mockHost,
    useColorScheme: () => 'light',
  }
})
// expo, expo-image and expo-video all map to one native-module stub (jest.config.js), so this one
// mock stands in for all three.
jest.mock('expo-video', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {useEffect, useState} = require('react') as typeof React
  return {
    Image: () => null,
    useEventListener: (_player: unknown, event: string, listener: () => void) => {
      mockPlayerListeners.push({event, listener})
    },
    VideoView: () => {
      useEffect(() => {
        mockMountedVideoViews++
        return () => {
          mockMountedVideoViews--
        }
      }, [])
      return null
    },
    useVideoPlayer: (_source: string, setup: (p: FakePlayer) => void) => {
      const [player] = useState(() => {
        const released = () => {
          if (mockPlayerReleased) throw new Error('NativeSharedObjectNotFoundException')
        }
        let loop = true
        const p = {pause: jest.fn(released), play: jest.fn(released), replay: jest.fn(released)} as Omit<
          FakePlayer,
          'loop'
        > as FakePlayer
        Object.defineProperty(p, 'loop', {
          get: () => loop,
          set: (v: boolean) => {
            released()
            loop = v
          },
        })
        mockPlayers.push(p)
        setup(p)
        return p
      })
      return player
    },
  }
})

/* eslint-disable @typescript-eslint/no-require-imports */
const {act, cleanup, render} = require('@testing-library/react') as typeof RTL
const Message = require('@/constants/chat/message') as typeof MessageModule
const TT = require('@/constants/types') as typeof T
const VideoImpl = (require('./videoimpl') as typeof VideoImplModule).default
/* eslint-enable @typescript-eslint/no-require-imports */

const message = Message.makeMessageAttachment({
  attachmentType: 'image',
  author: 'testuser',
  fileURL: 'http://127.0.0.1/file?id=1',
  id: TT.Chat.numberToMessageID(10),
  ordinal: TT.Chat.numberToOrdinal(10),
  previewHeight: 100,
  previewURL: 'http://127.0.0.1/preview?id=1',
  previewWidth: 200,
  videoDuration: '0:05',
})

const renderVideo = (openFullscreen?: () => void) =>
  render(<VideoImpl allowPlay={true} message={message} openFullscreen={openFullscreen} showPopup={() => {}} />)

const press = (pred: (p: HostProps) => boolean) => {
  const target = mockPressables.findLast(pred)
  if (!target) throw new Error('nothing to press')
  act(() => {
    target.onPress?.()
  })
}
const pressPoster = () => press(p => !!p.onLongPress)
const pressFullscreen = () => press(p => p.testID === 'video-fullscreen')
const hasFullscreenButton = () => mockPressables.some(p => p.testID === 'video-fullscreen')
const lastPlayer = () => mockPlayers.at(-1)

afterEach(() => {
  cleanup()
  mockPressables = []
  mockPlayers = []
  mockPlayerListeners = []
  mockPlayerReleased = false
  mockMountedVideoViews = 0
})

test('the poster plays the video inline, once', () => {
  renderVideo(jest.fn())

  pressPoster()

  const player = lastPlayer()!
  expect(player.play).toHaveBeenCalledTimes(1)
  expect(player.loop).toBe(false)
  act(() => {
    mockPlayerListeners.filter(l => l.event === 'playToEnd').forEach(l => l.listener())
  })
  expect(player.replay).not.toHaveBeenCalled()
  expect(player.play).toHaveBeenCalledTimes(1)
})

test('the fullscreen button on the poster opens fullscreen without playing inline', () => {
  const openFullscreen = jest.fn()
  renderVideo(openFullscreen)

  pressFullscreen()

  expect(openFullscreen).toHaveBeenCalledTimes(1)
  expect(mockPlayers).toEqual([])
})

test('the fullscreen button over the playing video opens fullscreen and stops the inline one', () => {
  const openFullscreen = jest.fn()
  renderVideo(openFullscreen)
  const poster = mockPressables.findLast(p => !!p.onLongPress)!
  // only what the playing video renders
  mockPressables = []
  act(() => {
    poster.onPress?.()
  })
  expect(mockMountedVideoViews).toBe(1)
  const button = mockPressables.findLast(p => p.testID === 'video-fullscreen')
  if (!button) throw new Error('no fullscreen button over the playing video')
  // what renders from here on
  mockPressables = []

  act(() => {
    button.onPress?.()
  })

  expect(openFullscreen).toHaveBeenCalledTimes(1)
  expect(mockMountedVideoViews).toBe(0)
  expect(mockPressables.some(p => !!p.onLongPress)).toBe(true)
})

test('no fullscreen button until the message is sent', () => {
  renderVideo(undefined)
  expect(hasFullscreenButton()).toBe(false)
})

test('a player released under a frozen screen does not throw from its setup', () => {
  mockPlayerReleased = true
  renderVideo(jest.fn())
  expect(() => pressPoster()).not.toThrow()
})
