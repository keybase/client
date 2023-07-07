import * as React from 'react'
import type {NotificationsGroupState} from '../../constants/settings-notifications'

export type Props = {
  allowEdit: boolean
  groups: Map<string, NotificationsGroupState>
  onBack?: () => void
  onClickYourAccount: () => void
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll: (group: string) => void
  waitingForResponse: boolean
  showEmailSection: boolean
  sound?: boolean
  onToggleSound?: (sound: boolean) => void
}

export default class Notifications extends React.Component<Props> {}
