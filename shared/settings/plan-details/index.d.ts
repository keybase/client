import {Component} from 'react'
import {PlanLevel} from '../../constants/types/settings'

export type PaymentVariants =
  | {
      type: 'credit-card-no-past'
      onAddCreditCard: () => void
    }
  | {
      type: 'credit-card-with-past'
      cardInfo: string
      onPayWithSavedCard: () => void
      onUpdateCard: () => void
    }
  | {
      type: 'apple-pay'
      onPayWithCardInstead: () => void
    }

export type Props = {
  plan: PlanLevel
  paymentOption: PaymentVariants
  price: string
  gigabytes: number
  onBack: () => void
  numStars: number
}

export default class PlanDetails extends Component<Props> {}
