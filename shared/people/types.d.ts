// @flow
import * as React from 'react'
// ts-ignore codemod issue
import * as Types from '../constants/types/people'

export type Props = {
  oldItems: Array<Types.PeopleScreenItem>
  newItems: Array<Types.PeopleScreenItem>
  followSuggestions: Array<Types.FollowSuggestion>
  getData: (markViewed?: boolean) => void
  onClickUser: (username: string) => void
  showAirdrop: boolean
  myUsername: string
  waiting: boolean
}

declare class People extends React.Component<Props> {}
declare class Header extends React.Component<{
  onClickUser: (username: string) => void
  myUsername: string
}> {}
