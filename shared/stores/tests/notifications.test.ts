/// <reference types="jest" />
import * as EngineGen from '@/actions/engine-gen-gen'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '../config'
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

test('badge engine updates fan out into config and badge counts', () => {
  const store = useNotifState
  const onFavoritesLoad = jest.fn()
  store.setState(
    {
      ...store.getState(),
      dispatch: {
        ...store.getState().dispatch,
        defer: {
          onFavoritesLoad,
        },
      },
    },
    true
  )

  const badgeState = {
    bigTeamBadgeCount: 4,
    deletedTeams: ['deleted-team'],
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
    teamsWithResetUsers: ['reset-team'],
    unverifiedEmails: 1,
    unverifiedPhones: 2,
  } as any

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {params: {badgeState}},
    type: EngineGen.keybase1NotifyBadgesBadgeState,
  } as any)

  expect(useConfigState.getState().badgeState).toEqual(badgeState)
  expect(onFavoritesLoad).toHaveBeenCalledTimes(1)
  expect(store.getState().mobileAppBadgeCount).toBe(7)
  expect(store.getState().desktopAppBadgeCount).toBe(22)
  expect(store.getState().navBadges.get(Tabs.peopleTab)).toBe(2)
  expect(store.getState().navBadges.get(Tabs.devicesTab)).toBe(1)
  expect(store.getState().navBadges.get(Tabs.chatTab)).toBe(7)
  expect(store.getState().navBadges.get(Tabs.gitTab)).toBe(1)
  expect(store.getState().navBadges.get(Tabs.teamsTab)).toBe(8)
  expect(store.getState().navBadges.get(Tabs.settingsTab)).toBe(3)
})
