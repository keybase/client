/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useBlockButtonsState} from './block-buttons-state'

const teamID = 'teamid-1' as T.Teams.TeamID

const gregorItem = (category: string, body?: string) =>
  ({
    item: {body: body === undefined ? undefined : new TextEncoder().encode(body), category},
  }) as unknown as {readonly item?: T.RPCGen.Gregor1.Item | null}

const blockItem = (id: string, adder: string) =>
  gregorItem(`blockButtons.${id}`, JSON.stringify({adder}))

const state = () => useBlockButtonsState.getState()
const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('updateFromGregorItems', () => {
  test('keeps only blockButtons categories and indexes them by team', () => {
    state().dispatch.updateFromGregorItems([
      gregorItem('somethingElse', JSON.stringify({adder: 'testuser-mac'})),
      blockItem(teamID, 'testuser-mac'),
    ])
    expect(state().blockButtonsMap.get(teamID)).toEqual({adder: 'testuser-mac'})
    expect(state().blockButtonsMap.size).toBe(1)
    expect(state().loaded).toBe(true)
  })

  test('skips items without a usable adder', () => {
    state().dispatch.updateFromGregorItems([
      gregorItem('blockButtons.a'),
      gregorItem('blockButtons.b', 'not json'),
      gregorItem('blockButtons.c', JSON.stringify({adder: 3})),
      gregorItem('blockButtons.d', JSON.stringify([])),
    ])
    expect(state().blockButtonsMap.size).toBe(0)
    // it still counts as loaded, so we don't refetch on every push
    expect(state().loaded).toBe(true)
  })

  test('a later push replaces the whole map', () => {
    state().dispatch.updateFromGregorItems([blockItem(teamID, 'testuser-mac')])
    state().dispatch.updateFromGregorItems([])
    expect(state().blockButtonsMap.size).toBe(0)
  })
})

describe('load', () => {
  test('fetches gregor state once and stops asking after it lands', async () => {
    const rpc = jest
      .spyOn(T.RPCGen, 'gregorGetStateRpcPromise')
      .mockResolvedValue({items: [blockItem(teamID, 'testuser-mac')]} as unknown as T.RPCGen.Gregor1.State)

    state().dispatch.load()
    // a second caller while the first is still in flight must not fire another rpc
    state().dispatch.load()
    await flushPromises()

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(state().blockButtonsMap.get(teamID)).toEqual({adder: 'testuser-mac'})

    state().dispatch.load()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('a failed load leaves the store unloaded so it can be retried', async () => {
    const rpc = jest
      .spyOn(T.RPCGen, 'gregorGetStateRpcPromise')
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValue({items: [blockItem(teamID, 'testuser-mac')]} as unknown as T.RPCGen.Gregor1.State)

    state().dispatch.load()
    await flushPromises()
    expect(state().loaded).toBe(false)

    state().dispatch.load()
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(state().blockButtonsMap.get(teamID)).toEqual({adder: 'testuser-mac'})
  })

  test('a load in flight at sign out cannot write into the new session', async () => {
    let resolveRpc: (value: T.RPCGen.Gregor1.State) => void = () => {}
    jest.spyOn(T.RPCGen, 'gregorGetStateRpcPromise').mockReturnValue(
      new Promise<T.RPCGen.Gregor1.State>(resolve => {
        resolveRpc = resolve
      })
    )

    state().dispatch.load()
    resetAllStores()
    resolveRpc({items: [blockItem(teamID, 'testuser-mac')]} as unknown as T.RPCGen.Gregor1.State)
    await flushPromises()

    expect(state().blockButtonsMap.size).toBe(0)
    expect(state().loaded).toBe(false)
  })

  test('a gregor push during a load in flight wins over the stale response', async () => {
    let resolveRpc: (value: T.RPCGen.Gregor1.State) => void = () => {}
    jest.spyOn(T.RPCGen, 'gregorGetStateRpcPromise').mockReturnValue(
      new Promise<T.RPCGen.Gregor1.State>(resolve => {
        resolveRpc = resolve
      })
    )

    state().dispatch.load()
    state().dispatch.updateFromGregorItems([])
    resolveRpc({items: [blockItem(teamID, 'testuser-mac')]} as unknown as T.RPCGen.Gregor1.State)
    await flushPromises()

    expect(state().blockButtonsMap.size).toBe(0)
  })
})
