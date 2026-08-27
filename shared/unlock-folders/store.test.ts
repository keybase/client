/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useUnlockFoldersState} from './store'

const device = (name: string) => ({
  deviceID: T.Devices.stringToDeviceID(`${name}-id`),
  name,
  type: 'desktop' as const,
})

afterEach(() => {
  resetAllStores()
})

test('opening stores the devices that can unlock the folders', () => {
  useUnlockFoldersState.getState().dispatch.open([device('testuser-mac')])

  expect(useUnlockFoldersState.getState().devices.map(d => d.name)).toEqual(['testuser-mac'])
})

test('reopening replaces the previous device list', () => {
  const {dispatch} = useUnlockFoldersState.getState()
  dispatch.open([device('testuser-mac')])
  dispatch.open([device('testuser-phone'), device('paper key')])

  expect(useUnlockFoldersState.getState().devices.map(d => d.name)).toEqual([
    'testuser-phone',
    'paper key',
  ])
})

test('reopening clears a stale paper key error', () => {
  const {dispatch} = useUnlockFoldersState.getState()
  dispatch.open([device('testuser-mac')])
  dispatch.setPaperKeyError('Invalid paper key')

  dispatch.open([device('testuser-mac')])

  expect(useUnlockFoldersState.getState().paperKeyError).toBe('')
})

test('closing throws away the devices and the error', () => {
  const {dispatch} = useUnlockFoldersState.getState()
  dispatch.open([device('testuser-mac')])
  dispatch.setPaperKeyError('Invalid paper key')

  dispatch.close()

  expect(useUnlockFoldersState.getState().devices).toEqual([])
  expect(useUnlockFoldersState.getState().paperKeyError).toBe('')
})

test('the stored devices are a copy of the caller list', () => {
  const devices = [device('testuser-mac')]
  useUnlockFoldersState.getState().dispatch.open(devices)

  devices.push(device('testuser-phone'))

  expect(useUnlockFoldersState.getState().devices).toHaveLength(1)
})
