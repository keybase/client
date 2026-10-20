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
  useFsFileContext: () => ({fileContext: {contentType: 'application/pdf'}}),
  useFsRedbarActions: () => ({redbar: () => {}}),
  useFsWatchDownloadForMobile: () => false,
}))
jest.mock('@/util/fs-platform', () => ({useSavedDownloadUri: () => 'content://dl/1'}))
jest.mock('@/util/fs-storeless-actions', () => ({openLocalPathInSystemFileManagerDesktop: jest.fn()}))

import * as PlatformSpecific from '@/util/platform-specific'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import Download from './download'

const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean}

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

test('on iOS the name is not tappable', () => {
  g.isMobile = true
  g.isAndroid = false
  render(<Download downloadID="id1" isFirst={true} />)
  expect(screen.getByText('a.pdf (static)')).toBeTruthy()
})
