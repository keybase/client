// @flow
import {List} from 'immutable'

import type {IconType} from '../common-adapters/icon'

const services: {[service: string]: true} = {
  Facebook: true,
  GitHub: true,
  'Hacker News': true,
  Keybase: true,
  Reddit: true,
  Twitter: true,
}

export type Service = $Keys<typeof services>

export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

export type RowProps = {|
  id: string,

  leftFollowingState: FollowingState,
  leftIcon: IconType,
  leftService: Service,
  leftUsername: string,

  rightFollowingState: FollowingState,
  rightFullname: ?string,
  rightIcon: ?IconType,
  rightService: ?Service,
  rightUsername: ?string,

  showTrackerButton: boolean,

  onShowTracker: () => void,
|}

export type State = {|
  // TODO selected, typing, etc
  rows: List<RowProps>,
|}
