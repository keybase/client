/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {runPopupIdentify} from './remote-proxy.desktop'

let errorLog: jest.SpyInstance

beforeEach(() => {
  errorLog = jest.spyOn(logger, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

const failIdentify = async (code: T.RPCGen.StatusCode) => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.identify3.identify3', () => fakeError(code, 'identify failed'))
  const onFailed = jest.fn()
  await runPopupIdentify({assertion: 'testuser', guiID: 'gui-1', ignoreCache: false}, onFailed)
  return onFailed
}

test('an identify the service fails puts the popup in the error state', async () => {
  const onFailed = await failIdentify(T.RPCGen.StatusCode.scgeneric)
  expect(onFailed).toHaveBeenCalledTimes(1)
  expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('Error loading tracker popup'))
})

test.each([
  ['a session cancel', T.RPCGen.StatusCode.sccanceled],
  ['an input cancel', T.RPCGen.StatusCode.scinputcanceled],
])('%s leaves the popup alone and logs no error', async (_, code) => {
  const onFailed = await failIdentify(code)
  expect(onFailed).not.toHaveBeenCalled()
  expect(errorLog).not.toHaveBeenCalled()
})
