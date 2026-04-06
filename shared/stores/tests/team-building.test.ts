/// <reference types="jest" />
import type * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {createTBStore} from '../team-building'

afterEach(() => {
  resetAllStores()
})

const makeUser = (id: string): T.TB.User =>
  ({
    id,
    prettyName: id,
    serviceId: 'keybase',
    serviceMap: {keybase: id},
    username: id,
  }) as T.TB.User

test('users can be added and removed from teamSoFar', () => {
  const store = createTBStore('teams')
  const alice = makeUser('alice')
  const bob = makeUser('bob')

  store.getState().dispatch.addUsersToTeamSoFar([alice, alice, bob])

  expect(store.getState().teamSoFar.size).toBe(2)
  expect(store.getState().teamSoFar.has(alice)).toBe(true)

  store.getState().dispatch.removeUsersFromTeamSoFar(['alice'])

  expect(store.getState().teamSoFar.size).toBe(1)
  expect(store.getState().teamSoFar.has(alice)).toBe(false)
  expect(store.getState().teamSoFar.has(bob)).toBe(true)
})

test('local setters update role, notifications, and error state', () => {
  const store = createTBStore('chat')

  store.getState().dispatch.selectRole('admin')
  store.getState().dispatch.changeSendNotification(false)
  store.getState().dispatch.setError('boom')

  expect(store.getState().selectedRole).toBe('admin')
  expect(store.getState().sendNotification).toBe(false)
  expect(store.getState().error).toBe('boom')
})

test('finishedTeamBuilding clears transient state but preserves namespace and selections', () => {
  const store = createTBStore('teams')
  const alice = makeUser('alice')

  store.getState().dispatch.addUsersToTeamSoFar([alice])
  store.getState().dispatch.selectRole('admin')
  store.getState().dispatch.changeSendNotification(false)
  store.getState().dispatch.setError('boom')

  store.getState().dispatch.finishedTeamBuilding()

  expect(store.getState().namespace).toBe('teams')
  expect(store.getState().selectedRole).toBe('admin')
  expect(store.getState().sendNotification).toBe(false)
  expect(store.getState().teamSoFar.size).toBe(1)
  expect(store.getState().error).toBe('')
  expect(store.getState().searchQuery).toBe('')
  expect(store.getState().searchResults.size).toBe(0)
})

test('finishTeamBuilding snapshots selected members before close reset', () => {
  const store = createTBStore('teams')
  const alice = makeUser('alice')
  const pushedMembers: Array<Array<T.Teams.AddingMember>> = []

  store.setState(s => {
    s.dispatch.closeTeamBuilding = () => {
      store.getState().dispatch.resetState()
    }
    s.dispatch.defer.onAddMembersWizardPushMembers = members => {
      pushedMembers.push(members)
    }
  })

  store.getState().dispatch.addUsersToTeamSoFar([alice])
  store.getState().dispatch.finishTeamBuilding()

  expect(pushedMembers).toEqual([[{assertion: 'alice', role: 'writer'}]])
})
