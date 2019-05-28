import {Component} from 'react'

export type Props = {
  email: string | null
  isVerified: boolean
  error?: Error | null
  onBack: () => void
  onSave: (email: string) => void
  waitingForResponse: boolean
  onResendConfirmationCode?: () => void
}

export default class UpdateEmail extends Component<Props> {}
