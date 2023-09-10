import * as React from 'react'
import * as Kb from '../../common-adapters'

export type Props = {
  onBack?: () => void
  children?: React.ReactNode
  style?: Kb.Styles.StylesCrossPlatform
  outerStyle?: Kb.Styles.StylesCrossPlatform
}

declare class Container extends React.Component<Props> {}
export default Container
