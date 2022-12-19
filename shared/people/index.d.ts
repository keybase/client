import * as React from 'react'
import * as Types from '../constants/types/people'

export type Props = {
  oldItems: Array<Types.PeopleScreenItem>
  newItems: Array<Types.PeopleScreenItem>
  wotUpdates: Map<string, Types.WotUpdate>
  followSuggestions: Array<Types.FollowSuggestion>
  getData: (markViewed?: boolean, force?: boolean) => void
  onClickUser: (username: string) => void
  onOpenAccountSwitcher?: () => void
  signupEmail: string
  myUsername: string
}
export type WrapProps = {
  waiting: boolean
} & Props

export default class People extends React.Component<WrapProps> {}
export class Header extends React.Component<{
  onClickUser: (username: string) => void
  myUsername: string
}> {}
