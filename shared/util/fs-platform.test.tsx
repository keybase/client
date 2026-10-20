/** @jest-environment jsdom */
/// <reference types="jest" />
import * as PlatformSpecific from '@/util/platform-specific'
import type * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {saveFinishedDownloadToPublicDownloads, useSavedDownload} from './fs-platform'

const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean}

const dlState = {canceled: false, done: true, endEstimate: 0, error: '', localPath: '/cache/a.pdf', progress: 1} as T.FS.DownloadState
const dlInfo = {filename: 'a.pdf'} as T.FS.DownloadInfo

const redbar = jest.fn()

beforeEach(() => {
  redbar.mockReset()
  g.isMobile = true
  g.isAndroid = true
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  resetAllStores()
  g.isMobile = false
  g.isAndroid = false
  jest.restoreAllMocks()
})

test('a finished download is saved once per download id', async () => {
  const save = jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
  await saveFinishedDownloadToPublicDownloads('id1', dlState, dlInfo, 'application/pdf', redbar)
  await saveFinishedDownloadToPublicDownloads('id1', dlState, dlInfo, 'application/pdf', redbar)
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledWith('/cache/a.pdf', 'a.pdf', 'application/pdf')
})

test('a failed save raises a redbar', async () => {
  jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockRejectedValue(new Error('nope'))
  await saveFinishedDownloadToPublicDownloads('id2', dlState, dlInfo, 'application/pdf', redbar)
  expect(redbar).toHaveBeenCalledWith(`Couldn't save a.pdf to Downloads: nope`)
})

test('useSavedDownload updates when the save resolves', async () => {
  let resolve: (u: string) => void = () => {}
  jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockReturnValue(new Promise(_resolve => (resolve = _resolve)))
  const {result} = renderHook(() => useSavedDownload('id3'))
  const p = saveFinishedDownloadToPublicDownloads('id3', dlState, dlInfo, 'application/pdf', redbar)
  expect(result.current).toBeUndefined()
  await act(async () => {
    resolve('content://dl/3')
    await p
  })
  expect(result.current).toEqual({mime: 'application/pdf', uri: 'content://dl/3'})
})

test('signing out clears saved uris', async () => {
  jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/4')
  const {result} = renderHook(() => useSavedDownload('id4'))
  await act(async () => {
    await saveFinishedDownloadToPublicDownloads('id4', dlState, dlInfo, 'application/pdf', redbar)
  })
  expect(result.current).toEqual({mime: 'application/pdf', uri: 'content://dl/4'})
  act(() => {
    resetAllStores()
  })
  expect(result.current).toBeUndefined()
})
