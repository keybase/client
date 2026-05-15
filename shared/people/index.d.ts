import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  dismissAnnouncement: (id: T.RPCGen.HomeScreenAnnouncementID) => void
  followSuggestions: ReadonlyArray<T.People.FollowSuggestion>
  getData: (markViewed?: boolean, force?: boolean) => void
  oldItems: T.Immutable<Array<T.People.PeopleScreenItem>>
  newItems: T.Immutable<Array<T.People.PeopleScreenItem>>
  onClickUser: (username: string) => void
  onOpenAccountSwitcher?: () => void
  resentEmail: string
  setResentEmail: (email: string) => void
  signupEmail: string
  skipTodo: (type: T.People.TodoType) => void
  myUsername: string
  // wotUpdates: Map<string, T.People.WotUpdate>
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
