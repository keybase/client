import type * as T from '@/constants/types'
import type * as React from 'react'
import type {NotificationsGroupState} from '@/constants/settings-notifications'

export type Props = {
  allowEdit: boolean
  groups: T.Immutable<Map<string, NotificationsGroupState>>
  onBack?: () => void
  onClickYourAccount: () => void
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll: (group: string) => void
  waitingForResponse: boolean
  showEmailSection: boolean
  sound?: boolean
  onToggleSound?: (sound: boolean) => void
}

declare const Notifications: (p: Props) => React.ReactNode
export default Notifications
