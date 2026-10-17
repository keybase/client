/// <reference types="jest" />
import * as T from '@/constants/types'
import {promptResult} from './result'

describe('promptResult', () => {
  test('yes without remember answers once', () => {
    expect(promptResult('foo.com', true, false)).toEqual({
      actionType: T.RPCChat.UnfurlPromptAction.onetime,
      onetime: 'foo.com',
    })
  })
  test('yes with remember accepts the domain', () => {
    expect(promptResult('foo.com', true, true)).toEqual({
      accept: 'foo.com',
      actionType: T.RPCChat.UnfurlPromptAction.accept,
    })
  })
  test('no without remember is not now', () => {
    expect(promptResult('foo.com', false, false)).toEqual({actionType: T.RPCChat.UnfurlPromptAction.notnow})
  })
  test('no with remember blocks the domain', () => {
    expect(promptResult('foo.com', false, true)).toEqual({
      actionType: T.RPCChat.UnfurlPromptAction.block,
      block: 'foo.com',
    })
  })
})
