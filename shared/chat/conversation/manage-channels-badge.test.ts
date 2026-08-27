/// <reference types="jest" />
import type * as T from '@/constants/types'
import {getChosenChannelsTeamnames} from './manage-channels-badge'

const stringToBody = (s: string) => new TextEncoder().encode(s)

const gregorItem = (category: string, body?: string) =>
  ({item: {body: body === undefined ? undefined : stringToBody(body), category}}) as unknown as {
    readonly item?: T.RPCGen.Gregor1.Item | null
  }

test('no gregor state means nothing has been chosen', () => {
  expect(getChosenChannelsTeamnames(undefined)).toEqual(new Set())
  expect(getChosenChannelsTeamnames(null)).toEqual(new Set())
  expect(getChosenChannelsTeamnames([])).toEqual(new Set())
})

test('picks the chosenChannelsForTeam category out of the gregor state', () => {
  const items = [
    gregorItem('somethingElse', JSON.stringify(['ignored'])),
    gregorItem('chosenChannelsForTeam', JSON.stringify(['teamone', 'teamtwo'])),
  ]
  expect(getChosenChannelsTeamnames(items)).toEqual(new Set(['teamone', 'teamtwo']))
})

test('ignores unparseable or non-array bodies', () => {
  expect(getChosenChannelsTeamnames([gregorItem('chosenChannelsForTeam')])).toEqual(new Set())
  expect(getChosenChannelsTeamnames([gregorItem('chosenChannelsForTeam', 'not json')])).toEqual(new Set())
  expect(getChosenChannelsTeamnames([gregorItem('chosenChannelsForTeam', '{"a":1}')])).toEqual(new Set())
})

test('drops non-string entries so a bad body cannot poison the set', () => {
  const items = [gregorItem('chosenChannelsForTeam', JSON.stringify(['teamone', 3, null, 'teamtwo']))]
  expect(getChosenChannelsTeamnames(items)).toEqual(new Set(['teamone', 'teamtwo']))
})

test('dedupes repeated teamnames', () => {
  const items = [gregorItem('chosenChannelsForTeam', JSON.stringify(['teamone', 'teamone']))]
  expect(getChosenChannelsTeamnames(items).size).toBe(1)
})
