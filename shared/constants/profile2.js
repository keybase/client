// @flow
import * as Types from './types/profile2'
import * as I from 'immutable'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  usernameToDetails: I.Map(),
})

export const makeDetails: I.RecordFactory<Types._Details> = I.Record({
  assertions: I.Map(),
  bio: null,
  followThem: null,
  followersCount: null,
  followingCount: null,
  followsYou: null,
  fullname: null,
  guiID: null,
  location: null,
  publishedTeams: null,
})

export const makeAssertion: I.RecordFactory<Types._Assertion> = I.Record({
  metas: [],
  proofURL: '',
  site: '',
  siteIcon: '',
  siteURL: '',
  state: 'error',
  username: '',
})

export const noDetails = makeDetails({})
export const noAssertion = makeAssertion({})
