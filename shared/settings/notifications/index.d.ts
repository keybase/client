import {Component} from 'react'
import * as Types from '../../constants/types/settings'

export type Props = {
  allowEdit: boolean
  groups: {
    [K in string]: {
      settings: Array<Types._NotificationsSettingsState>
      unsubscribedFromAll: boolean
    }
  }
  onBack?: () => void
  onClickYourAccount: () => void
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll: (group: string) => void
  mobileHasPermissions: boolean
  waitingForResponse: boolean
  showEmailSection: boolean
  sound?: boolean
  onToggleSound?: (sound: boolean) => void
}

export default class Notifications extends Component<Props> {}
