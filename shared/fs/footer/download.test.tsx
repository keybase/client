/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    Icon: () => React.createElement('div'),
    Styles: {
      collapseStyles: () => ({}),
      createStyleHook: () => () => ({}),
      platformStyles: () => ({}),
      useTheme: () => ({}),
    },
    Text: ({children, onClick}: {children?: string; onClick?: () => void}) =>
      React.createElement('span', {onClick}, onClick ? children : `${children ?? ''} (static)`),
  }
})
jest.mock('./download-wrapper', () => ({children}: {children?: React.ReactNode}): React.ReactNode => children)
jest.mock('../common', () => ({
  useFsCancelDownload: () => () => {},
  useFsDismissDownload: () => () => {},
  useFsDownloadInfo: () => ({filename: 'a.pdf', path: '/keybase/private/testuser/a.pdf'}),
  useFsDownloadState: () => ({done: true, localPath: '/cache/a.pdf', progress: 1}),
  useFsRedbarActions: () => ({redbar: () => {}}),
  useFsWatchDownloadForMobile: () => false,
}))
let mockSaved: {uri: string; mime: string} | undefined
jest.mock('@/util/fs-platform', () => ({useSavedDownload: () => mockSaved}))
jest.mock('@/util/fs-storeless-actions', () => ({openLocalPathInSystemFileManagerDesktop: jest.fn()}))
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'

import * as PlatformSpecific from '@/util/platform-specific'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import Download from './download'

const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean}

beforeEach(() => {
  mockSaved = {mime: 'application/pdf', uri: 'content://dl/1'}
})

afterEach(() => {
  cleanup()
  g.isMobile = false
  g.isAndroid = false
  jest.restoreAllMocks()
})

test('on Android, tapping a saved download\'s name opens it', () => {
  g.isMobile = true
  g.isAndroid = true
  const open = jest.spyOn(PlatformSpecific, 'openSavedFile').mockResolvedValue()
  render(<Download downloadID="id1" isFirst={true} />)
  fireEvent.click(screen.getByText('a.pdf'))
  expect(open).toHaveBeenCalledWith('content://dl/1', 'application/pdf')
})

test('on Android with no saved download yet, the name is not tappable', () => {
  g.isMobile = true
  g.isAndroid = true
  mockSaved = undefined
  render(<Download downloadID="id1" isFirst={true} />)
  expect(screen.getByText('a.pdf (static)')).toBeTruthy()
})

test('on desktop, tapping the name opens the local path', () => {
  render(<Download downloadID="id1" isFirst={true} />)
  fireEvent.click(screen.getByText('a.pdf'))
  expect(openLocalPathInSystemFileManagerDesktop).toHaveBeenCalledWith('/cache/a.pdf')
})

test('on iOS the name is not tappable', () => {
  g.isMobile = true
  g.isAndroid = false
  render(<Download downloadID="id1" isFirst={true} />)
  expect(screen.getByText('a.pdf (static)')).toBeTruthy()
})
