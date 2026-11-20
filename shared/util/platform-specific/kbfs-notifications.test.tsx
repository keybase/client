/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {kbfsNotification} from './kbfs-notifications'

afterEach(() => {
  resetAllStores()
})

const accessDenied = (params: {[key: string]: string}): T.RPCGen.FSNotification => ({
  errorType: T.RPCGen.FSErrorType.accessDenied,
  filename: '/keybase/public/testuser',
  folderType: T.RPCGen.FolderType.public,
  localTime: 0,
  notificationType: T.RPCGen.FSNotificationType.signing,
  params,
  status: 'public folder writes are disabled',
  statusCode: T.RPCGen.FSStatusCode.error,
  writerUid: '',
})

const bodyFor = (params: {[key: string]: string}) => {
  const notify = jest.fn()
  kbfsNotification(accessDenied(params), notify)
  expect(notify).toHaveBeenCalledTimes(1)
  return (notify.mock.calls[0] as [string, {body?: string}])[1].body
}

test('access denied names the folder', () => {
  useCurrentUserState.setState({username: 'testuser'})
  expect(bodyFor({mode: 'write'})).toBe('testuser does not have write access to /keybase/public/testuser')
})

test('access denied says when changes were discarded', () => {
  useCurrentUserState.setState({username: 'testuser'})
  expect(bodyFor({discarded: 'true', mode: 'write'})).toBe(
    'testuser does not have write access to /keybase/public/testuser. Changes there that had not uploaded yet were discarded.'
  )
})
