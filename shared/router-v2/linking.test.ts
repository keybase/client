/// <reference types="jest" />
const mockSetDeepLinkFallback = jest.fn()

jest.mock('./deep-link-emitter', () => ({
  normalizeUrl: (url: string) => url,
  setDeepLinkFallback: (...args: Array<unknown>) => mockSetDeepLinkFallback(...args),
  setDeepLinkListener: jest.fn(),
  setInitialURLOnce: (url: string) => url,
}))

import {createLinkingConfig} from './linking'

const setIsMobile = (value: boolean) => {
  Object.defineProperty(globalThis, 'isMobile', {configurable: true, value, writable: true})
}

afterEach(() => {
  mockSetDeepLinkFallback.mockClear()
  setIsMobile(false)
})

test('does not install the imperative fallback on mobile', () => {
  setIsMobile(true)

  createLinkingConfig(jest.fn())

  expect(mockSetDeepLinkFallback).not.toHaveBeenCalled()
})

test('installs the imperative fallback on desktop', () => {
  setIsMobile(false)
  const fallback = jest.fn()

  createLinkingConfig(fallback)

  expect(mockSetDeepLinkFallback).toHaveBeenCalledTimes(1)
  expect(mockSetDeepLinkFallback).toHaveBeenCalledWith(fallback)
})
