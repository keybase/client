import {Component} from 'react'
import * as Types from '../../constants/types/search'
import {IconType} from '../../common-adapters'

export type UserDetails = {
  id: string
  followingState: Types.FollowingState
  icon?: IconType
  service: Types.Service
  username: string
}

export type Props = {
  autoFocus?: boolean
  hideAddButton?: boolean
  placeholder?: string
  userItems: Array<UserDetails>
  usernameText: string
  onChangeText: (usernameText: string) => void
  onRemoveUser: (id: string) => void
  onClickAddButton: (() => void) | null
  onMoveSelectUp: () => void
  onMoveSelectDown: () => void
  onCancel?: () => void
  onClearSearch?: () => void
  onAddSelectedUser: () => void
  onEnterEmptyText?: () => void
  onFocus?: () => void
  selectedSearchId: string | null
  hideClearSearch?: boolean
}

export default class UserInput extends Component<Props> {
  focus: () => void
}
