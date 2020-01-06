import * as Constants from '../constants/tracker2'
import * as Types from '../constants/types/tracker2'
import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import shallowEqual from 'shallowequal'

// We could try and only send diffs but the payloads are small and handling the removing case is tricky and likely not worth it
export const serialize = {
  ...Avatar.serialize,
  assertions: (v?: Map<string, Types.Assertion>) => (v ? [...v.entries()] : v),
  bio: (v?: string) => v,
  blocked: (v: boolean) => v,
  darkMode: (v: boolean) => v,
  followThem: (v: boolean) => v,
  followersCount: (v?: number) => v,
  followingCount: (v?: number) => v,
  followsYou: (v: boolean) => v,
  fullname: (v?: string) => v,
  guiID: (v: string) => v,
  hidFromFollowers: (v: boolean) => v,
  isYou: (v: boolean) => v,
  location: (v?: string) => v,
  reason: (v: string) => v,
  state: (v: Types.DetailsState) => v,
  teamShowcase: (v?: Array<Types.TeamShowcase>, o?: Array<Types.TeamShowcase>) =>
    o && shallowEqual(v, o) ? undefined : v,
  username: (v: string) => v,
  usernames: (v: Array<string>) => v,
  waiting: (v: boolean) => v,
  windowComponent: (v: string) => v,
  windowOpts: (v: Object) => v,
  windowParam: (v: string) => v,
  windowPositionBottomRight: (v: boolean) => v,
  windowTitle: (v: string) => v,
}

const initialState = {
  assertions: new Map(),
  config: {following: new Set()},
  teams: {teamNameToID: new Map()},
  users: {infoMap: new Map()},
  waiting: {counts: new Map()},
}

type Props = Partial<{
  // ...Avatar.serialize, // TODO this type
  assertions: Map<string, Types.Assertion>
  bio: string
  blocked: boolean
  darkMode: boolean
  followThem: boolean
  followersCount: number
  followingCount: number
  followsYou: boolean
  fullname: string
  guiID: string
  hidFromFollowers: boolean
  isYou: boolean
  location: string
  reason: string
  state: Types.DetailsState
  stellarHidden: boolean
  teamShowcase: Array<Types.TeamShowcase>
  o?: Array<Types.TeamShowcase>
  username: string
  waiting: boolean
  windowComponent: string
  windowOpts: Object
  windowParam: string
  windowPositionBottomRight: boolean
  windowTitle: string
}>

export const deserialize = (state: typeof initialState = initialState, props: Props) => {
  const newState = {
    ...state,
    ...props,
    ...(props && props.assertions ? {assertions: new Map(props.assertions)} : {}),
    ...(props && props.username
      ? {users: {infoMap: new Map([[props.username, {broken: false, fullname: props.fullname}]])}}
      : {}),
    waiting: {counts: new Map([[Constants.waitingKey, props && props.waiting]])},
  }
  // TODO
  return newState // Avatar.deserialize(newState, props)
}
