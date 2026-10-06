// The team builder's recommendations: the people the server suggests (and, in the chat builder,
// the phone's contacts) are server-picked and server-ordered. The builder keeps them in its
// per-namespace store, which outlives the screen, so begin clears each store and end puts it back.
import type * as T from '@/constants/types'
import {stub, type FixtureDef, type StoreApi, type StoreKey} from './def.ts'

// Hyphens never appear in a Keybase username, so these can never name a real account.
const people: ReadonlyArray<T.RPCGen.InterestingPerson> = [
  {fullname: 'Ada Fixture', serviceMap: {github: 'ada-fixture'}, uid: '', username: 'vg-ada'},
  {fullname: 'Ben Fixture', serviceMap: {}, uid: '', username: 'vg-ben'},
  {fullname: '', serviceMap: {twitter: 'cy_fixture'}, uid: '', username: 'vg-cy'},
]

const contacts: ReadonlyArray<T.RPCGen.ProcessedContact> = [
  {
    assertion: 'dee@example.com@email',
    component: {email: 'dee@example.com', label: 'home'},
    contactIndex: 0,
    contactName: 'Dee Fixture',
    displayLabel: 'dee@example.com',
    displayName: 'Dee Fixture',
    following: false,
    fullName: '',
    resolved: false,
    serviceMap: {},
    uid: '',
    username: '',
  },
]

const stores: ReadonlyArray<StoreKey> = ['tb:chat', 'tb:crypto', 'tb:people', 'tb:teams']

type TBState = {dispatch: {resetState: () => void}}

export const teamBuilderRecs: FixtureDef = {
  // recommendations from an earlier, live open of the builder would show before the stub answers
  beforeNav: s => {
    for (const key of stores) ((s.get(key) as StoreApi | undefined)?.getState() as TBState | undefined)?.dispatch.resetState()
  },
  rpc: [
    stub('keybase.1.user.interestingPeople', () => people, {required: true}),
    // only the chat builder asks
    stub('keybase.1.contacts.getContactsForUserRecommendations', () => contacts, {required: false}),
  ],
  stores,
  teardown: 'remount',
}
