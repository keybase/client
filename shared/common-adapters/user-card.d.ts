import * as React from 'react'

export type Props = {
  onAvatarClicked?: () => void
  outerStyle?: Object | null
  style?: any
  username?: string
  children?: React.ReactNode
}

declare class UserCard extends React.Component<Props> {}
export default UserCard
