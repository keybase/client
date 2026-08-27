/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'

// the real list chrome is native/electron-only; we only care about which repos
// survive parsing and how they are grouped and ordered
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    ClickableBox: passThrough,
    ErrorBanner: ({error}: {error?: Error}) =>
      error ? React.createElement('div', null, error.message) : null,
    FloatingMenu: () => React.createElement('div'),
    Icon: () => React.createElement('div'),
    Reloadable: passThrough,
    SectionDivider: ({label}: {label?: string}) =>
      React.createElement('div', {'data-section': label}, label),
    SectionList: ({
      renderItem,
      renderSectionHeader,
      sections,
    }: {
      renderItem: (p: {item: string}) => React.ReactNode
      renderSectionHeader: (p: {section: {title: string}}) => React.ReactNode
      sections: Array<{data: Array<string>; title: string}>
    }) =>
      React.createElement(
        'div',
        null,
        sections.map(section =>
          React.createElement(
            'div',
            {key: section.title},
            renderSectionHeader({section}),
            section.data.map(item => React.createElement('div', {key: item}, renderItem({item})))
          )
        )
      ),
    Styles: {
      createStyleHook:
        <S,>(styles: (theme: unknown) => S) =>
        () =>
          styles({blue: 'blue'}),
      globalMargins: {small: 8, tiny: 4},
      useTheme: () => ({blue: 'blue'}),
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
    usePopup2: () => ({popup: null, popupAnchor: null, showPopup: () => {}}),
  }
})
jest.mock('./row', () => ({
  __esModule: true,
  default: ({git}: {git: {id: string; name: string; teamname?: string}}) =>
    require('react').createElement(
      'div',
      {'data-repo': git.id},
      git.teamname ? `${git.teamname}/${git.name}` : git.name
    ),
}))
jest.mock('@/util/use-local-badging', () => {
  const React = require('react')
  return {
    NewItemsContext: React.createContext(new Set<string>()),
    useIsNew: () => false,
    useLocalBadging: () => ({badged: new Set<string>()}),
  }
})

let mockRPCResults: Array<T.RPCGen.GitRepoResult> = []
jest.mock('@/util/use-rpc-load', () => {
  const React = require('react')
  return {
    useRPCLoad: (
      _call: unknown,
      _args: unknown,
      opts: {map: (r: unknown) => unknown; onResult?: (d: unknown) => void}
    ) => {
      const onResultRef = React.useRef(opts.onResult)
      onResultRef.current = opts.onResult
      const [data] = React.useState(() => opts.map(mockRPCResults))
      // the real hook reports results from an effect, not during render
      React.useEffect(() => {
        onResultRef.current?.(data)
      }, [data])
      return {data, loadCount: 0, reload: () => {}}
    },
  }
})

import {cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import Git from './index'

const makeOK = (
  name: string,
  overrides: {folderType?: T.RPCGen.FolderType; id?: string; teamname?: string} = {}
): T.RPCGen.GitRepoResult =>
  ({
    ok: {
      canDelete: true,
      folder: {
        created: false,
        folderType: overrides.folderType ?? T.RPCGen.FolderType.private,
        name: overrides.teamname ?? 'testuser',
      },
      globalUniqueID: overrides.id ?? `id-${overrides.teamname ?? 'personal'}-${name}`,
      localMetadata: {previousRepoName: name, pushType: 0, refs: null, repoName: name},
      repoID: `repo-${name}`,
      repoUrl: `keybase://private/testuser/${name}`,
      serverMetadata: {
        ctime: 0,
        lastModifyingDeviceID: 'did',
        lastModifyingDeviceName: 'testuser-mac',
        lastModifyingUsername: 'testuser',
        mtime: 1700000000000,
      },
      teamRepoSettings: null,
    },
    state: T.RPCGen.GitRepoResultState.ok,
  }) as T.RPCGen.GitRepoResult

const reposInSection = (title: string) => {
  const header = document.querySelector(`[data-section="${title}"]`)
  const section = header?.parentElement
  return [...(section?.querySelectorAll('[data-repo]') ?? [])].map(n => n.textContent ?? '')
}

afterEach(() => {
  cleanup()
  resetAllStores()
  mockRPCResults = []
})

test('personal and team repos are split into their own sections', () => {
  mockRPCResults = [
    makeOK('zeta'),
    makeOK('beta', {folderType: T.RPCGen.FolderType.team, teamname: 'keybase'}),
    makeOK('alpha'),
  ]

  render(<Git />)

  expect(reposInSection('Personal')).toEqual(['alpha', 'zeta'])
  expect(reposInSection('Team')).toEqual(['keybase/beta'])
})

test('team repos sort by team name first, then repo name', () => {
  mockRPCResults = [
    makeOK('zeta', {folderType: T.RPCGen.FolderType.team, teamname: 'alphateam'}),
    makeOK('beta', {folderType: T.RPCGen.FolderType.team, teamname: 'zetateam'}),
    makeOK('alpha', {folderType: T.RPCGen.FolderType.team, teamname: 'alphateam'}),
  ]

  render(<Git />)

  expect(reposInSection('Team')).toEqual(['alphateam/alpha', 'alphateam/zeta', 'zetateam/beta'])
})

test('public repos are dropped entirely', () => {
  mockRPCResults = [makeOK('secret'), makeOK('shouty', {folderType: T.RPCGen.FolderType.public})]

  render(<Git />)

  expect(reposInSection('Personal')).toEqual(['secret'])
  expect(reposInSection('Team')).toEqual([])
})

test('per-repo errors become global errors without dropping the good repos', () => {
  const setGlobalError = jest.fn()
  useConfigState.setState(s => ({...s, dispatch: {...s.dispatch, setGlobalError}}))
  mockRPCResults = [
    makeOK('good'),
    {err: 'repo is corrupt', state: T.RPCGen.GitRepoResultState.err} as T.RPCGen.GitRepoResult,
  ]

  render(<Git />)

  expect(reposInSection('Personal')).toEqual(['good'])
  expect(setGlobalError).toHaveBeenCalledWith(
    expect.objectContaining({message: 'Git repo error: repo is corrupt'})
  )
})

test('repos with the same name in different teams keep separate rows', () => {
  mockRPCResults = [
    makeOK('shared', {folderType: T.RPCGen.FolderType.team, id: 'id-a', teamname: 'teama'}),
    makeOK('shared', {folderType: T.RPCGen.FolderType.team, id: 'id-b', teamname: 'teamb'}),
  ]

  render(<Git />)

  expect(reposInSection('Team')).toEqual(['teama/shared', 'teamb/shared'])
})

test('an empty result renders both sections with nothing in them', () => {
  mockRPCResults = []

  render(<Git />)

  expect(screen.queryByText('Personal')).not.toBeNull()
  expect(screen.queryByText('Team')).not.toBeNull()
  expect(document.querySelectorAll('[data-repo]')).toHaveLength(0)
})
