import * as React from 'react'
import * as Types from '../constants/types/people'

export type Props = {
  oldItems: Array<Types.PeopleScreenItem>
  newItems: Array<Types.PeopleScreenItem>
  wotUpdates: Map<string, Types.WotUpdate>
  followSuggestions: Array<Types.FollowSuggestion>
  getData: (markViewed?: boolean) => void
  onClickUser: (username: string) => void
  onOpenAccountSwitcher?: () => void
  signupEmail: string
  myUsername: string
  waiting: boolean
}

export default class People extends React.Component<Props> {}
export class Header extends React.Component<{
  onClickUser: (username: string) => void
  myUsername: string
}> {}
