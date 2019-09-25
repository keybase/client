import * as I from 'immutable'
import * as Constants from '../constants/tracker2'
import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import shallowEqual from 'shallowequal'

// We could try and only send diffs but the payloads are small and handling the removing case is tricky and likely not worth it
export const serialize: any = {
  ...Avatar.serialize,
  airdropIsLive: (v: any) => v,
  assertions: (v: any) => (v ? v.toJS() : v),
  bio: (v: any) => v,
  darkMode: (v: any) => v,
  followThem: (v: any) => v,
  followersCount: (v: any) => v,
  followingCount: (v: any) => v,
  followsYou: (v: any) => v,
  fullname: (v: any) => v,
  guiID: (v: any) => v,
  isYou: (v: any) => v,
  location: (v: any) => v,
  publishedTeams: (v: any, o: any) => (o && shallowEqual(v, o) ? undefined : v),
  reason: (v: any) => v,
  registeredForAirdrop: (v: any) => v,
  state: (v: any) => v,
  teamShowcase: (v: any, o: any) => (o && shallowEqual(v, o) ? undefined : v.toJS()),
  username: (v: any) => v,
  waiting: (v: any) => v,
  windowComponent: (v: any) => v,
  windowOpts: (v: any) => v,
  windowParam: (v: any) => v,
  windowPositionBottomRight: (v: any) => v,
  windowTitle: (v: any) => v,
  youAreInAirdrop: (v: any) => v,
}

const initialState = {
  assertions: I.Map(),
  config: {following: I.Set()},
  users: {infoMap: I.Map()},
  waiting: {counts: I.Map()},
}

export const deserialize = (state: any = initialState, props: any) => {
  const newState = {
    ...state,
    ...props,
    ...(props && props.assertions
      ? {
          assertions: I.Map(
            Object.keys(props.assertions).map(assertionKey => [
              assertionKey,
              Constants.makeAssertion(props.assertions[assertionKey]),
            ])
          ),
        }
      : {}),
    ...(props && props.teamShowcase
      ? {teamShowcase: I.List(props.teamShowcase.map(t => Constants.makeTeamShowcase(t)))}
      : {}),
    ...(props && props.username
      ? {users: {infoMap: I.Map([[props.username, {broken: false, fullname: props.fullname}]])}}
      : {}),
    ...(props && Object.prototype.hasOwnProperty.call(props, 'waiting')
      ? {waiting: {counts: I.Map([[Constants.waitingKey, props.waiting || 0]])}}
      : {}),
  }
  return Avatar.deserialize(newState, props)
}
