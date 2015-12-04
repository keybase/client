/* @flow */

import type {SimpleProofState} from '../constants/tracker'

export type ActionProps = {
  state: SimpleProofState,
  currentlyFollowing: boolean,
  username: ?string,
  shouldFollow: ?boolean,
  renderChangedTitle: string,
  onClose: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  onFollowHelp: () => void,
  onFollowChecked: () => void
}

