import * as I from 'immutable'
import * as Constants from '../constants/tracker2'
import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import shallowEqual from 'shallowequal'

// We could try and only send diffs but the payloads are small and handling the removing case is tricky and likely not worth it
export const serialize: any = {
  ...Avatar.serialize,
  airdropIsLive: v => v,
  assertions: v => (v ? v.toJS() : v),
  bio: v => v,
  followThem: v => v,
  followersCount: v => v,
  followingCount: v => v,
  followsYou: v => v,
  fullname: v => v,
  guiID: v => v,
  isYou: v => v,
  location: v => v,
  publishedTeams: (v, o) => (o && shallowEqual(v, o) ? undefined : v),
  reason: v => v,
  registeredForAirdrop: v => v,
  state: v => v,
  teamShowcase: (v, o) => (o && shallowEqual(v, o) ? undefined : v.toJS()),
  username: v => v,
  waiting: v => v,
  windowComponent: v => v,
  windowOpts: v => v,
  windowParam: v => v,
  windowPositionBottomRight: v => v,
  windowTitle: v => v,
  youAreInAirdrop: v => v,
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
