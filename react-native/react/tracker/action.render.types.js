/* @flow */

import type {SimpleProofState} from '../constants/tracker'

export type ActionProps = {
  state: SimpleProofState,
  currentlyFollowing: boolean,
  username: ?string,
  shouldFollow: ?boolean,
  renderChangedTitle: string,
  failedProofsNotFollowingText: string,
  onClose: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  onFollowHelp: () => void,
  onFollowChecked: () => void
}

