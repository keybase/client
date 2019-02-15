// @flow
import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'

export const serialize: any = {
  ...Avatar.serialize,
  actionBarReady: v => v,
  changed: v => v,
  closed: v => v,
  currentlyFollowing: v => v,
  description: v => v,
  eldestKidChanged: v => v,
  error: v => v,
  errorMessage: v => v,
  following: v => v,
  hidden: v => v,
  inviteLink: v => v,
  isPrivate: v => v,
  lastAction: v => v,
  loading: v => v,
  loggedIn: v => v,
  memberCount: v => v,
  myUsername: v => v,
  name: v => v,
  needTrackTokenDismiss: v => v,
  nonUser: v => v,
  openTeam: v => v,
  proofs: v => v,
  publicAdmins: v => v,
  publicAdminsOthers: v => v,
  reason: v => v,
  selectedTeam: v => v,
  serverActive: v => v,
  sessionID: v => v,
  shouldFollow: v => v,
  showTeam: v => v,
  stellarFederationAddress: v => v,
  teamJoinError: v => v,
  teamJoinSuccess: v => v,
  teamname: v => v,
  tlfs: v => v,
  trackToken: v => v,
  trackerState: v => v,
  trackers: v => v,
  trackersLoaded: v => v,
  tracking: v => v,
  type: v => v,
  userInfo: v => v,
  username: v => v,
  waiting: v => v,
  windowComponent: v => v,
  windowOpts: v => v,
  windowParam: v => v,
  windowPositionBottomRight: v => v,
  windowTitle: v => v,
  youAreInTeam: v => v,
  youHaveRequestedAccess: v => v,
}

const initialState = {
  config: {},
}

export const deserialize = (state: any = initialState, props: any) => {
  const newState = {
    ...state,
    ...props,
  }
  return Avatar.deserialize(newState, props)
}
