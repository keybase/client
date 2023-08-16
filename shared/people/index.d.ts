import * as React from 'react'
import * as T from '../constants/types'

export type Props = {
  oldItems: Array<T.People.PeopleScreenItem>
  newItems: Array<T.People.PeopleScreenItem>
  // wotUpdates: Map<string, T.People.WotUpdate>
  followSuggestions: Array<T.People.FollowSuggestion>
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
