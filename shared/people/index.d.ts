import type * as React from 'react'
import type * as T from '@/constants/types'

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

export declare const Header: (p: {
  onClickUser: (username: string) => void
  myUsername: string
}) => React.ReactNode
declare const People: (p: WrapProps) => React.ReactNode
export default People
