/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useDaemonState} from '@/stores/daemon'
import {useCurrentSkinTone, useReactionRowTopReacjis, useSetSkinTone, useTopReacjis} from './user-reacjis'

const defaultTopReacjis = [':+1:', ':-1:', ':tada:', ':joy:', ':sunglasses:']

const setUserReacjis = (userReacjis?: T.RPCGen.UserReacjis) => {
  useDaemonState.setState({bootstrapStatus: {userReacjis} as T.RPCGen.BootstrapStatus})
}

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('useTopReacjis', () => {
  test('falls back to the built in reacjis before bootstrap lands', () => {
    expect(renderHook(() => useTopReacjis()).result.current.map(r => r.name)).toEqual(defaultTopReacjis)
  })

  test('falls back when the daemon sends no reacjis', () => {
    setUserReacjis({skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: undefined})
    expect(renderHook(() => useTopReacjis()).result.current.map(r => r.name)).toEqual(defaultTopReacjis)
  })

  test('drops entries that are not plain :shortcodes:', () => {
    setUserReacjis({
      skinTone: T.RPCGen.ReacjiSkinTone.none,
      topReacjis: [
        {name: ':fire:'},
        {name: 'fire'},
        {name: ':not:closed'},
        {name: ':a::b:'},
        {name: ':wave:'},
      ],
    })
    expect(renderHook(() => useTopReacjis()).result.current.map(r => r.name)).toEqual([':fire:', ':wave:'])
  })
})

describe('useReactionRowTopReacjis', () => {
  test('shows at most five reacjis', () => {
    setUserReacjis({
      skinTone: T.RPCGen.ReacjiSkinTone.none,
      topReacjis: [':a:', ':b:', ':c:', ':d:', ':e:', ':f:'].map(name => ({name})),
    })
    expect(renderHook(() => useReactionRowTopReacjis()).result.current.map(r => r.name)).toEqual([
      ':a:',
      ':b:',
      ':c:',
      ':d:',
      ':e:',
    ])
  })

  test('drops the empty slots when there are fewer than five', () => {
    setUserReacjis({skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: [{name: ':a:'}, {name: ':b:'}]})
    expect(renderHook(() => useReactionRowTopReacjis()).result.current).toHaveLength(2)
  })
})

describe('skin tone', () => {
  test('defaults to the lightest tone until the daemon says otherwise', () => {
    expect(renderHook(() => useCurrentSkinTone()).result.current).toBe('1F3FB')
  })

  test('maps the rpc value, with none meaning the default yellow', () => {
    setUserReacjis({skinTone: T.RPCGen.ReacjiSkinTone.skintone4})
    const {result} = renderHook(() => useCurrentSkinTone())
    expect(result.current).toBe('1F3FE')
    act(() => {
      setUserReacjis({skinTone: T.RPCGen.ReacjiSkinTone.none})
    })
    expect(result.current).toBeUndefined()
  })

  test('setting a tone sends it to the service and stores what comes back', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localPutReacjiSkinToneRpcPromise')
      .mockResolvedValue({skinTone: T.RPCGen.ReacjiSkinTone.skintone3, topReacjis: [{name: ':fire:'}]})
    setUserReacjis({skinTone: T.RPCGen.ReacjiSkinTone.none})

    const {result} = renderHook(() => useSetSkinTone())
    await act(async () => {
      result.current('1F3FD')
      await flushPromises()
    })

    expect(rpc).toHaveBeenCalledWith({skinTone: T.RPCGen.ReacjiSkinTone.skintone3})
    expect(useDaemonState.getState().bootstrapStatus?.userReacjis.skinTone).toBe(
      T.RPCGen.ReacjiSkinTone.skintone3
    )
  })

  test('clearing the tone sends none', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localPutReacjiSkinToneRpcPromise')
      .mockResolvedValue({skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: []})
    setUserReacjis({skinTone: T.RPCGen.ReacjiSkinTone.skintone3})

    const {result} = renderHook(() => useSetSkinTone())
    await act(async () => {
      result.current(undefined)
      await flushPromises()
    })

    expect(rpc).toHaveBeenCalledWith({skinTone: T.RPCGen.ReacjiSkinTone.none})
  })
})
