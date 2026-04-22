/// <reference types="jest" />
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '../current-user'
import {useNotifState} from '../notifications'

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('badgeApp derives the widget badge from key state', () => {
  const store = useNotifState

  store.getState().dispatch.badgeApp('kbfsUploading', true)
  expect(store.getState().widgetBadge).toBe('uploading')

  store.getState().dispatch.badgeApp('outOfSpace', true)
  expect(store.getState().widgetBadge).toBe('error')

  store.getState().dispatch.badgeApp('outOfSpace', false)
  expect(store.getState().widgetBadge).toBe('uploading')

  store.getState().dispatch.badgeApp('kbfsUploading', false)
  expect(store.getState().widgetBadge).toBe('regular')
})

test('badge engine updates badge counts', () => {
  const store = useNotifState

  const badgeState = {
    bigTeamBadgeCount: 4,
    deletedTeams: [{teamName: 'deleted-team'}],
    homeTodoItems: 2,
    inboxVers: 1,
    newDevices: ['other-device'],
    newGitRepoGlobalUniqueIDs: ['git-1'],
    newTeamAccessRequestCount: 5,
    newTeams: ['team-1'],
    newTlfs: 1,
    rekeysNeeded: 0,
    revokedDevices: ['device-id'],
    smallTeamBadgeCount: 3,
    teamsWithResetUsers: [{teamID: 'team-1', username: 'bob'}],
    unverifiedEmails: 1,
    unverifiedPhones: 2,
  } as any

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {params: {badgeState}},
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)

  expect(store.getState().mobileAppBadgeCount).toBe(7)
  expect(store.getState().desktopAppBadgeCount).toBe(22)
  expect(store.getState().navBadges.get(Tabs.peopleTab)).toBe(2)
  expect(store.getState().navBadges.get(Tabs.devicesTab)).toBe(1)
  expect(store.getState().navBadges.get(Tabs.chatTab)).toBe(7)
  expect(store.getState().navBadges.get(Tabs.gitTab)).toBe(1)
  expect(store.getState().navBadges.get(Tabs.teamsTab)).toBe(8)
  expect(store.getState().navBadges.get(Tabs.settingsTab)).toBe(3)
  expect(store.getState().deletedTeams).toEqual([{teamName: 'deleted-team'}])
  expect(store.getState().newTeams.has('team-1')).toBe(true)
  expect(store.getState().teamIDToResetUsers.get('team-1')).toEqual(new Set(['bob']))
})

test('stale badgeState events do not regress badge counts', () => {
  const store = useNotifState

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        badgeState: {
          bigTeamBadgeCount: 4,
          homeTodoItems: 2,
          inboxVers: 2,
          newTeamAccessRequestCount: 0,
          smallTeamBadgeCount: 3,
          unverifiedEmails: 1,
          unverifiedPhones: 2,
        },
      },
    },
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        badgeState: {
          bigTeamBadgeCount: 1,
          homeTodoItems: 1,
          inboxVers: 1,
          newTeamAccessRequestCount: 0,
          smallTeamBadgeCount: 1,
          unverifiedEmails: 0,
          unverifiedPhones: 0,
        },
      },
    },
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)

  expect(store.getState().badgeVersion).toBe(2)
  expect(store.getState().mobileAppBadgeCount).toBe(7)
  expect(store.getState().navBadges.get(Tabs.chatTab)).toBe(7)
  expect(store.getState().navBadges.get(Tabs.peopleTab)).toBe(2)
  expect(store.getState().navBadges.get(Tabs.settingsTab)).toBe(3)
  expect(store.getState().deletedTeams).toEqual([])
  expect(store.getState().newTeams.size).toBe(0)
  expect(store.getState().teamIDToResetUsers.size).toBe(0)
})

test('gregor push state populates per-team access requests', () => {
  const store = useNotifState
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        state: {
          items: [
            {
              item: {
                body: encode({id: 'team-1', username: 'alice'}),
                category: 'team.request_access:team-1',
              },
              md: {},
            },
            {
              item: {
                body: encode({id: 'team-1', username: 'bob'}),
                category: 'team.request_access:team-1',
              },
              md: {},
            },
            {
              item: {
                body: encode({id: 'team-2', username: 'charlie'}),
                category: 'team.request_access:team-2',
              },
              md: {},
            },
          ],
        },
      },
    },
    type: 'keybase.1.gregorUI.pushState',
  } as any)

  expect(store.getState().newTeamRequests.get('team-1')).toEqual(new Set(['alice', 'bob']))
  expect(store.getState().newTeamRequests.get('team-2')).toEqual(new Set(['charlie']))
})
