import * as React from 'react'
import * as Kb from '../../../../../common-adapters'

export type Props = {
  style: Kb.Styles.StylesCrossPlatform
  children: React.ReactNode
}

export default class PendingPaymentBackground extends React.Component<Props> {}
