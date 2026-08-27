/// <reference types="jest" />
import {expect, jest, test, describe, beforeEach, afterEach} from '@jest/globals'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useUsersState} from '@/stores/users'
import {createTBStore} from '../team-building'

type SearchArgs = {
  includeContacts: boolean
  includeServicesSummary: boolean
  maxResults: number
  query: string
  service: T.TB.ServiceIdWithContact
}

let searchCalls: Array<SearchArgs> = []
let respond: (args: SearchArgs) => Array<T.RPCGen.APIUserSearchResult> = () => []

jest.spyOn(T.RPCGen, 'userSearchUserSearchRpcPromise').mockImplementation(async (params: unknown) => {
  const args = params as SearchArgs
  searchCalls.push(args)
  await Promise.resolve()
  return respond(args) as never
})

const userUpdates: Array<Array<{info: {fullname: string}; name: string}>> = []
const blockRequests: Array<ReadonlyArray<string>> = []
// resetAllStores hands back a fresh dispatch object, so re-spy for each test
const spyOnUsersStore = () => {
  jest.spyOn(useUsersState.getState().dispatch, 'updates').mockImplementation(u => {
    userUpdates.push(u as Array<{info: {fullname: string}; name: string}>)
  })
  jest.spyOn(useUsersState.getState().dispatch, 'getBlockState').mockImplementation(u => {
    blockRequests.push(u)
  })
}

// search() is fire-and-forget; drain the microtask/timer queue so its awaits land
const flush = async () => {
  for (let i = 0; i < 50; i++) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

const keybaseResult = (username: string, fullName = ''): T.RPCGen.APIUserSearchResult =>
  ({
    keybase: {fullName, username},
    servicesSummary: {twitter: {username: `${username}tw`}},
  }) as unknown as T.RPCGen.APIUserSearchResult

beforeEach(() => {
  searchCalls = []
  userUpdates.length = 0
  blockRequests.length = 0
  respond = () => []
  spyOnUsersStore()
})

afterEach(() => {
  resetAllStores()
})

describe('team building search', () => {
  test('keybase results are parsed and stored under the trimmed query', async () => {
    const store = createTBStore('crypto')
    respond = () => [keybaseResult('testuser', 'Test User'), keybaseResult('testuser-mac')]

    store.getState().dispatch.search('  testuser  ', 'keybase', false)
    await flush()

    expect(searchCalls[0]?.query).toBe('testuser')
    const results = store.getState().searchResults.get('testuser')?.get('keybase')
    expect(results?.map(u => u.id)).toEqual(['testuser', 'testuser-mac'])
    // fullName wins as the pretty name, username is the fallback
    expect(results?.[0]?.prettyName).toBe('Test User')
    expect(results?.[1]?.prettyName).toBe('testuser-mac')
    // the keybase service is injected into the service map, it is not in the summary
    expect(results?.[0]?.serviceMap).toEqual({keybase: 'testuser', twitter: 'testusertw'})
  })

  test('results feed the users store so names and block state are known', async () => {
    const store = createTBStore('crypto')
    respond = () => [keybaseResult('testuser', 'Test User')]

    store.getState().dispatch.search('testuser', 'keybase', false)
    await flush()

    expect(userUpdates.at(-1)).toEqual([{info: {fullname: 'Test User'}, name: 'testuser'}])
    expect(blockRequests.at(-1)).toEqual(['testuser'])
  })

  test('a non-keybase service builds a compound assertion id when the user is also on keybase', async () => {
    const store = createTBStore('crypto')
    respond = () => [
      {
        keybase: {fullName: 'Test User', pictureUrl: 'kb.png', username: 'testuser'},
        service: {fullName: '', pictureUrl: 'tw.png', serviceName: 'twitter', username: 'twuser'},
      } as unknown as T.RPCGen.APIUserSearchResult,
      {
        service: {fullName: 'Just Twitter', serviceName: 'twitter', username: 'lonely'},
      } as unknown as T.RPCGen.APIUserSearchResult,
    ]

    store.getState().dispatch.search('twuser', 'twitter', false)
    await flush()

    const results = store.getState().searchResults.get('twuser')?.get('twitter')
    expect(results?.map(u => u.id)).toEqual(['twuser@twitter+testuser', 'lonely@twitter'])
    // keybase's picture wins over the service one
    expect(results?.[0]?.pictureUrl).toBe('kb.png')
    // and the keybase full name backfills an empty service full name
    expect(results?.[0]?.prettyName).toBe('Test User')
    expect(results?.[1]?.prettyName).toBe('Just Twitter')
  })

  test('a result from the wrong service is dropped rather than mislabeled', async () => {
    const store = createTBStore('crypto')
    respond = () => [
      {service: {serviceName: 'github', username: 'gh'}} as unknown as T.RPCGen.APIUserSearchResult,
      {service: {serviceName: 'twitter', username: 'tw'}} as unknown as T.RPCGen.APIUserSearchResult,
    ]

    store.getState().dispatch.search('x', 'twitter', false)
    await flush()

    expect(store.getState().searchResults.get('x')?.get('twitter')?.map(u => u.id)).toEqual(['tw@twitter'])
  })

  test('an email query gets a second lookup whose result is pinned to the top', async () => {
    const store = createTBStore('crypto')
    respond = args =>
      args.service === 'email'
        ? [
            {
              imptofu: {
                assertion: 'a@b.com@email',
                assertionKey: 'email',
                assertionValue: 'a@b.com',
                keybaseUsername: '',
                label: '',
                prettyName: 'someone',
              },
            } as unknown as T.RPCGen.APIUserSearchResult,
          ]
        : [keybaseResult('testuser')]

    store.getState().dispatch.search('a@b.com', 'keybase', false)
    await flush()

    expect(searchCalls.map(c => c.service)).toEqual(['keybase', 'email'])
    // the extra lookup asks for exactly one result and never contacts
    expect(searchCalls[1]?.maxResults).toBe(1)
    expect(searchCalls[1]?.includeContacts).toBe(false)

    const results = store.getState().searchResults.get('a@b.com')?.get('keybase')
    expect(results?.map(u => u.id)).toEqual(['a@b.com@email', 'testuser'])
    // the pinned result is relabeled with what the user typed so it stands out
    expect(results?.[0]?.prettyName).toBe('a@b.com')
    expect(results?.[0]?.serviceId).toBe('email')
  })

  test('the extra email lookup is not duplicated when the main search already found it', async () => {
    const store = createTBStore('crypto')
    const imptofu = {
      imptofu: {
        assertion: 'a@b.com@email',
        assertionKey: 'email',
        assertionValue: 'a@b.com',
        keybaseUsername: '',
        label: '',
        prettyName: 'someone',
      },
    } as unknown as T.RPCGen.APIUserSearchResult

    respond = () => [imptofu]

    store.getState().dispatch.search('a@b.com', 'keybase', false)
    await flush()

    const results = store.getState().searchResults.get('a@b.com')?.get('keybase')
    expect(results?.map(u => u.id)).toEqual(['a@b.com@email'])
    // the already-present result keeps its original pretty name
    expect(results?.[0]?.prettyName).toBe('someone')
  })

  test('a plain username query does no second lookup', async () => {
    const store = createTBStore('crypto')
    respond = () => [keybaseResult('testuser')]

    store.getState().dispatch.search('testuser', 'keybase', false)
    await flush()

    expect(searchCalls.map(c => c.service)).toEqual(['keybase'])
  })

  test('contacts are only requested on the keybase tab and only when asked for', async () => {
    const store = createTBStore('crypto')
    store.getState().dispatch.search('testuser', 'keybase', true)
    await flush()
    expect(searchCalls.at(-1)?.includeContacts).toBe(true)

    store.getState().dispatch.search('testuser', 'twitter', true)
    await flush()
    expect(searchCalls.at(-1)?.includeContacts).toBe(false)
  })

  test('a limit over 100 is refused before any rpc goes out', async () => {
    const store = createTBStore('crypto')
    store.getState().dispatch.search('testuser', 'keybase', false, 101)
    await flush()
    expect(searchCalls).toEqual([])
    expect(store.getState().searchResults.size).toBe(0)
  })

  test('the default limit is used when none is given', async () => {
    const store = createTBStore('crypto')
    store.getState().dispatch.search('testuser', 'keybase', false)
    await flush()
    expect(searchCalls[0]?.maxResults).toBe(11)
  })

  test('searches for different services on the same query live side by side', async () => {
    const store = createTBStore('crypto')
    respond = args =>
      args.service === 'keybase'
        ? [keybaseResult('testuser')]
        : [{service: {serviceName: 'twitter', username: 'testuser'}} as unknown as T.RPCGen.APIUserSearchResult]

    store.getState().dispatch.search('testuser', 'keybase', false)
    await flush()
    store.getState().dispatch.search('testuser', 'twitter', false)
    await flush()

    const forQuery = store.getState().searchResults.get('testuser')
    expect([...(forQuery?.keys() ?? [])]).toEqual(['keybase', 'twitter'])
  })
})
