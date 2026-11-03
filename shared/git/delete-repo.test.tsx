/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {navigationWrapper} from '@/test/navigation'
import DeleteRepo from './delete-repo'

const deletePersonal = 'keybase.1.git.deletePersonalRepo'
const deleteTeam = 'keybase.1.git.deleteTeamRepo'

// The service holds both deletes until the test answers them
const serve = () => {
  const fake = installFakeEngine()
  return {fake, personal: fake.hold(deletePersonal), team: fake.hold(deleteTeam)}
}
const params = (p: {params: {sessionID?: number}}) => {
  const {sessionID: _, ...rest} = p.params
  return rest
}

// the confirm button: the real button around its label, which it marks disabled
const confirmButton = () => {
  const button = screen.getByText(/Delete this repository|^Delete$/).closest<HTMLElement>('.button--primary')
  if (!button) throw new Error('no confirm button')
  return {disabled: button.classList.contains('button--disabled'), el: button}
}
const typeName = (name: string) =>
  fireEvent.change(screen.getByPlaceholderText('Name of the repository'), {target: {value: name}})

// The confirm as a real modal route
let nav: ReturnType<typeof navigationWrapper>
const renderDelete = (ui: React.ReactElement) => {
  nav = navigationWrapper({params: {name: 'myrepo'}, route: 'gitDeleteRepo'})
  return render(ui, {wrapper: nav.wrapper})
}

afterEach(() => {
  cleanup()
  resetAllStores()
})

const routeNames = () => nav.getRootState()?.routes?.map(r => r.name)

test('deleting a personal repo needs the exact repo name typed back', async () => {
  const {personal, team} = serve()
  renderDelete(<DeleteRepo name="myrepo" />)

  expect(confirmButton().disabled).toBe(true)

  typeName('myrep')
  expect(confirmButton().disabled).toBe(true)
  fireEvent.click(confirmButton().el)
  await flush()
  expect(personal).toHaveLength(0)

  typeName('myrepo')
  expect(confirmButton().disabled).toBe(false)
  fireEvent.click(confirmButton().el)
  await flush()
  expect(personal.map(params)).toEqual([{repoName: 'myrepo'}])
  expect(team).toHaveLength(0)

  // the confirm stays up, waiting on the git key, until the service says the delete went through
  expect(useWaitingState.getState().counts.get(C.waitingKeyGitLoading)).toBe(1)
  expect(routeNames()).toEqual(['loggedIn', 'gitDeleteRepo'])
  personal[0]!.reply(null)
  await flush()
  expect(routeNames()).toEqual(['loggedIn'])
})

test('a team repo also accepts the fully qualified teamname/repo form', () => {
  serve()
  renderDelete(<DeleteRepo name="myrepo" teamname="keybase.sub" />)

  typeName('myrepo')
  expect(confirmButton().disabled).toBe(false)

  typeName('keybase.sub/myrepo')
  expect(confirmButton().disabled).toBe(false)

  typeName('keybase.sub/other')
  expect(confirmButton().disabled).toBe(true)
})

test('a team delete splits the team name into parts and notifies the team by default', async () => {
  const {personal, team} = serve()
  renderDelete(<DeleteRepo name="myrepo" teamname="keybase.sub" />)

  typeName('keybase.sub/myrepo')
  fireEvent.click(confirmButton().el)
  await flush()

  expect(team.map(params)).toEqual([{notifyTeam: true, repoName: 'myrepo', teamName: {parts: ['keybase', 'sub']}}])
  expect(personal).toHaveLength(0)
})

test('unchecking notify the team is respected', async () => {
  const {team} = serve()
  renderDelete(<DeleteRepo name="myrepo" teamname="keybase" />)

  fireEvent.click(screen.getByText('Notify the team'))
  typeName('myrepo')
  fireEvent.click(confirmButton().el)
  await flush()

  expect(team.map(params)).toEqual([{notifyTeam: false, repoName: 'myrepo', teamName: {parts: ['keybase']}}])
})

test('failures from the service are shown to the user and leave the confirm up', async () => {
  const {personal} = serve()
  renderDelete(<DeleteRepo name="myrepo" />)

  typeName('myrepo')
  fireEvent.click(confirmButton().el)
  await flush()

  personal[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'repo is locked'))
  await flush()

  expect(screen.queryByText(/repo is locked/)).not.toBeNull()
  expect(routeNames()).toEqual(['loggedIn', 'gitDeleteRepo'])
})
