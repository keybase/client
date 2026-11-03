/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import '@/test/viewport.desktop'
import {cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import * as Tabs from '@/constants/tabs'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Git from './index'

const allMetadata = 'keybase.1.git.getAllGitMetadata'

// The service answers the metadata load the screen makes when it is focused, and the badge dismiss
const serve = (results: Array<T.RPCGen.GitRepoResult>) => {
  const fake = installFakeEngine()
  fake.answer(allMetadata, () => results)
  fake.answer('keybase.1.gregor.dismissCategory', () => null)
  return fake
}

// the git tab's root, on the real navigation tree, once the service has answered
const renderGit = async (props: React.ComponentProps<typeof Git> = {}) => {
  render(<Git {...props} />, {wrapper: navigationWrapper({route: 'gitRoot', tab: Tabs.gitTab}).wrapper})
  await flush()
}

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

const rows = () => [...document.querySelectorAll<HTMLElement>(`[data-testid="${TestIDs.GIT_REPO_ROW}"]`)]
// a row's repo, as it draws it: teamname/name for a team repo
const repoOf = (row: HTMLElement) => row.querySelector('.text_BodySemibold')?.textContent ?? ''
// an expanded row shows the repo's clone url
const expandedRepos = () => rows().filter(row => row.textContent.includes('Clone:')).map(repoOf)

// the rows drawn after a section's header and before the next one's
const reposInSection = (title: string) => {
  const headers = [...document.querySelectorAll<HTMLElement>('.text_BodySmallSemibold')].filter(
    h => h.textContent === 'Personal' || h.textContent === 'Team'
  )
  const header = headers.find(h => h.textContent === title)
  if (!header) throw new Error(`no ${title} section`)
  const next = headers[headers.indexOf(header) + 1]
  const after = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  return rows()
    .filter(row => after(header, row) && (!next || after(row, next)))
    .map(repoOf)
}

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('personal and team repos are split into their own sections', async () => {
  serve([
    makeOK('zeta'),
    makeOK('beta', {folderType: T.RPCGen.FolderType.team, teamname: 'keybase'}),
    makeOK('alpha'),
  ])

  await renderGit()

  expect(reposInSection('Personal')).toEqual(['alpha', 'zeta'])
  expect(reposInSection('Team')).toEqual(['keybase/beta'])
})

test('team repos sort by team name first, then repo name', async () => {
  serve([
    makeOK('zeta', {folderType: T.RPCGen.FolderType.team, teamname: 'alphateam'}),
    makeOK('beta', {folderType: T.RPCGen.FolderType.team, teamname: 'zetateam'}),
    makeOK('alpha', {folderType: T.RPCGen.FolderType.team, teamname: 'alphateam'}),
  ])

  await renderGit()

  expect(reposInSection('Team')).toEqual(['alphateam/alpha', 'alphateam/zeta', 'zetateam/beta'])
})

test('public repos are dropped entirely', async () => {
  serve([makeOK('secret'), makeOK('shouty', {folderType: T.RPCGen.FolderType.public})])

  await renderGit()

  expect(reposInSection('Personal')).toEqual(['secret'])
  expect(reposInSection('Team')).toEqual([])
})

test('per-repo errors become global errors without dropping the good repos', async () => {
  serve([
    makeOK('good'),
    {err: 'repo is corrupt', state: T.RPCGen.GitRepoResultState.err} as T.RPCGen.GitRepoResult,
  ])

  await renderGit()

  expect(reposInSection('Personal')).toEqual(['good'])
  expect(useConfigState.getState().globalError?.message).toBe('Git repo error: repo is corrupt')
})

test('repos with the same name in different teams keep separate rows', async () => {
  serve([
    makeOK('shared', {folderType: T.RPCGen.FolderType.team, id: 'id-a', teamname: 'teama'}),
    makeOK('shared', {folderType: T.RPCGen.FolderType.team, id: 'id-b', teamname: 'teamb'}),
  ])

  await renderGit()

  expect(reposInSection('Team')).toEqual(['teama/shared', 'teamb/shared'])
})

test('an empty result renders both sections with nothing in them', async () => {
  serve([])

  await renderGit()

  expect(screen.queryByText('Personal')).not.toBeNull()
  expect(screen.queryByText('Team')).not.toBeNull()
  expect(rows()).toHaveLength(0)
})

test('a personal repo from the route params expands without a teamname', async () => {
  serve([makeOK('alpha'), makeOK('beta')])

  await renderGit({expandedRepoID: 'repo-alpha'})

  expect(expandedRepos()).toEqual(['alpha'])
})

test('a team repo only expands for its own team', async () => {
  const fake = serve([
    makeOK('alpha'),
    makeOK('alpha', {folderType: T.RPCGen.FolderType.team, id: 'id-team-alpha', teamname: 'keybase'}),
  ])
  // an expanded team repo looks up the channel its pushes are announced in
  fake.answer('keybase.1.git.getTeamRepoSettings', () => ({channelName: 'general', chatDisabled: false}))

  await renderGit({expandedRepoID: 'repo-alpha', expandedTeamname: 'keybase'})

  expect(expandedRepos()).toEqual(['keybase/alpha'])
})

test('a repo from the route params expands once the list it is in arrives', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(allMetadata)
  fake.answer('keybase.1.gregor.dismissCategory', () => null)
  await renderGit({expandedRepoID: 'repo-alpha'})
  expect(rows()).toHaveLength(0)
  expect(held.length).toBeGreaterThan(0)

  // the screen keeps only its latest load's answer
  held.forEach(h => h.reply([makeOK('alpha'), makeOK('beta')]))
  await flush()

  expect(reposInSection('Personal')).toEqual(['alpha', 'beta'])
  expect(expandedRepos()).toEqual(['alpha'])
})
