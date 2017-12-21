// @flow
import * as I from 'immutable'
import * as Types from './types/people'

export const makePeopleScreen: I.RecordFactory<Types._PeopleScreen> = I.Record({
  lastViewed: new Date(),
  version: -1,
  items: [],
  followSuggestions: [],
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  data: makePeopleScreen(),
})
