/// <reference types="jest" />
import {expect, jest, test, describe, beforeEach, afterEach} from '@jest/globals'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {createTBStore} from '../team-building'

let interestingPeople: Array<T.RPCGen.InterestingPerson> = []
let contacts: Array<T.RPCGen.ProcessedContact> = []
let interestingCalls: Array<{maxUsers: number; namespace: string}> = []
let contactCalls = 0
let interestingThrows = false

jest.spyOn(T.RPCGen, 'userInterestingPeopleRpcPromise').mockImplementation(async (params: unknown) => {
  interestingCalls.push(params as {maxUsers: number; namespace: string})
  await Promise.resolve()
  if (interestingThrows) {
    throw new Error('nope')
  }
  return interestingPeople as never
})
jest
  .spyOn(T.RPCGen, 'contactsGetContactsForUserRecommendationsRpcPromise')
  .mockImplementation(async () => {
    contactCalls++
    await Promise.resolve()
    return contacts as never
  })

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

const person = (username: string, fullname = username): T.RPCGen.InterestingPerson =>
  ({fullname, serviceMap: {twitter: `${username}tw`}, username}) as unknown as T.RPCGen.InterestingPerson

const contact = (assertion: string, phone?: string): T.RPCGen.ProcessedContact =>
  ({
    assertion,
    component: phone ? {phoneNumber: phone} : {email: assertion},
    displayLabel: 'label',
    displayName: 'name',
    serviceMap: {},
    username: '',
  }) as unknown as T.RPCGen.ProcessedContact

beforeEach(() => {
  interestingPeople = []
  contacts = []
  interestingCalls = []
  contactCalls = 0
  interestingThrows = false
})

afterEach(() => {
  resetAllStores()
})

describe('fetchUserRecs', () => {
  test('outside chat only interesting people are fetched', async () => {
    const store = createTBStore('teams')
    interestingPeople = [person('testuser', 'Test User')]

    store.getState().dispatch.fetchUserRecs()
    await flush()

    expect(contactCalls).toBe(0)
    expect(interestingCalls[0]).toEqual({maxUsers: 50, namespace: 'teams'})
    expect(store.getState().userRecs).toEqual([
      {
        id: 'testuser',
        prettyName: 'Test User',
        serviceId: 'keybase',
        serviceMap: {keybase: 'testuser', twitter: 'testusertw'},
        username: 'testuser',
      },
    ])
  })

  test('chat pulls contacts too and puts them after the suggestions', async () => {
    const store = createTBStore('chat')
    interestingPeople = [person('testuser')]
    contacts = [contact('a@b.com'), contact('+15551212@phone', '+15551212')]

    store.getState().dispatch.fetchUserRecs()
    await flush()

    expect(contactCalls).toBe(1)
    const recs = store.getState().userRecs
    expect(recs?.map(r => r.id)).toEqual(['testuser', 'a@b.com', '+15551212@phone'])
    expect(recs?.[1]?.serviceId).toBe('email')
    expect(recs?.[2]?.serviceId).toBe('phone')
    expect(recs?.[1]?.contact).toBe(true)
  })

  test('suggestions are capped at ten to leave room for imported contacts', async () => {
    useSettingsContactsState.setState({importEnabled: true})
    const store = createTBStore('chat')
    interestingPeople = Array.from({length: 25}, (_, i) => person(`user${i}`))
    contacts = [contact('a@b.com')]

    store.getState().dispatch.fetchUserRecs()
    await flush()

    const recs = store.getState().userRecs
    expect(recs).toHaveLength(11)
    expect(recs?.slice(0, 10).map(r => r.id)).toEqual(
      Array.from({length: 10}, (_, i) => `user${i}`)
    )
    expect(recs?.at(-1)?.id).toBe('a@b.com')
  })

  test('with contact import off every suggestion is kept', async () => {
    useSettingsContactsState.setState({importEnabled: false})
    const store = createTBStore('chat')
    interestingPeople = Array.from({length: 25}, (_, i) => person(`user${i}`))

    store.getState().dispatch.fetchUserRecs()
    await flush()

    expect(store.getState().userRecs).toHaveLength(25)
  })

  test('outside chat the import setting does not truncate suggestions', async () => {
    useSettingsContactsState.setState({importEnabled: true})
    const store = createTBStore('teams')
    interestingPeople = Array.from({length: 25}, (_, i) => person(`user${i}`))

    store.getState().dispatch.fetchUserRecs()
    await flush()

    expect(store.getState().userRecs).toHaveLength(25)
  })

  test('a failure leaves an empty list rather than a spinner forever', async () => {
    const store = createTBStore('teams')
    interestingThrows = true

    store.getState().dispatch.fetchUserRecs()
    await flush()

    expect(store.getState().userRecs).toEqual([])
  })

  test('proof-only entries in a service map are not treated as services', async () => {
    const store = createTBStore('teams')
    interestingPeople = [
      {
        fullname: 'Test User',
        serviceMap: {dns: 'example.com', github: 'ghuser', https: 'example.com'},
        username: 'testuser',
      } as unknown as T.RPCGen.InterestingPerson,
    ]

    store.getState().dispatch.fetchUserRecs()
    await flush()

    expect(store.getState().userRecs?.[0]?.serviceMap).toEqual({
      github: 'ghuser',
      keybase: 'testuser',
    })
  })
})
