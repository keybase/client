import {Component} from 'react'

import {PlanLevel} from '../../constants/types/settings'
import {PaymentInfo, AvailablePlan} from '../../constants/types/plan-billing'

export type PlanProps = {
  onInfo: (level: PlanLevel) => void
  selectedLevel: PlanLevel
  freeSpace: string
  freeSpacePercentage: number
  lowSpaceWarning: boolean
  paymentInfo: PaymentInfo | null
  onChangePaymentInfo: () => void
}

export type AccountProps = {
  email: string
  isVerified: boolean
  onChangeEmail: () => void
  onChangePassword: () => void
  onChangeRememberPassword: (remember: boolean) => void
  rememberPassword: boolean
  hasRandomPW: boolean | null
}

export type Props = {
  plan: PlanProps
  plans: Array<AvailablePlan>
  account: AccountProps
}

export default class LandingPage extends Component<Props> {}
