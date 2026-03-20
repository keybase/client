/// <reference types="jest" />
const mockNavigateAppend = jest.fn()

jest.mock('@/constants/router', () => ({
  navigateAppend: (...args: Array<unknown>) => mockNavigateAppend(...args),
  navigateUp: jest.fn(),
}))

import * as Constants from '../../constants/fs'
import * as T from '../../constants/types'
import {useCurrentUserState} from '../current-user'
import {makeActionsForDestinationPickerOpen, makeEditID, resetBannerType, useFSState} from '../fs'

const bootstrapCurrentUser = () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
}

beforeEach(() => {
  bootstrapCurrentUser()
  mockNavigateAppend.mockClear()
  useFSState.getState().dispatch.resetState?.()
})

afterEach(() => {
  useFSState.getState().dispatch.resetState?.()
})

test('makeEditID returns distinct non-empty edit identifiers', () => {
  const first = makeEditID()
  const second = makeEditID()

  expect(first).toBeTruthy()
  expect(second).toBeTruthy()
  expect(first).not.toBe(second)
})

test('makeActionsForDestinationPickerOpen stores the parent path and navigates', () => {
  const path = T.FS.stringToPath('/keybase/private/alice')

  makeActionsForDestinationPickerOpen(1, path)

  expect(useFSState.getState().destinationPicker.destinationParentPath[1]).toBe(path)
  expect(mockNavigateAppend).toHaveBeenCalledWith({name: 'destinationPicker', params: {index: 1}})
})

test('soft error setters add and remove path and tlf errors', () => {
  const {dispatch} = useFSState.getState()
  const path = T.FS.stringToPath('/keybase/private/alice/file.txt')
  const tlfPath = T.FS.stringToPath('/keybase/private/alice')

  dispatch.setPathSoftError(path, T.FS.SoftError.Nonexistent)
  dispatch.setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
  expect(useFSState.getState().softErrors.pathErrors.get(path)).toBe(T.FS.SoftError.Nonexistent)
  expect(useFSState.getState().softErrors.tlfErrors.get(tlfPath)).toBe(T.FS.SoftError.NoAccess)

  dispatch.setPathSoftError(path)
  dispatch.setTlfSoftError(tlfPath)
  expect(useFSState.getState().softErrors.pathErrors.has(path)).toBe(false)
  expect(useFSState.getState().softErrors.tlfErrors.has(tlfPath)).toBe(false)
})

test('resetBannerType distinguishes between self resets, other resets, and no resets', () => {
  const privateTlfName = 'alice,bob'
  const path = T.FS.stringToPath(`/keybase/private/${privateTlfName}`)

  useFSState.setState({
    tlfs: {
      ...useFSState.getState().tlfs,
      private: new Map([
        [
          privateTlfName,
          {
            ...Constants.unknownTlf,
            name: privateTlfName,
            resetParticipants: ['alice'],
          },
        ],
      ]),
    },
  } as any)
  expect(resetBannerType(useFSState.getState(), path)).toBe(T.FS.ResetBannerNoOthersType.Self)

  useFSState.setState({
    tlfs: {
      ...useFSState.getState().tlfs,
      private: new Map([
        [
          privateTlfName,
          {
            ...Constants.unknownTlf,
            name: privateTlfName,
            resetParticipants: ['bob', 'carol'],
          },
        ],
      ]),
    },
  } as any)
  expect(resetBannerType(useFSState.getState(), path)).toBe(2)

  useFSState.setState({
    tlfs: {
      ...useFSState.getState().tlfs,
      private: new Map([[privateTlfName, {...Constants.unknownTlf, name: privateTlfName, resetParticipants: []}]]),
    },
  } as any)
  expect(resetBannerType(useFSState.getState(), path)).toBe(T.FS.ResetBannerNoOthersType.None)
})
