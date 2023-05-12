import * as React from 'react'
import * as Styles from '../../styles'

export type Props = {
  onBack?: () => void
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
  outerStyle?: Styles.StylesCrossPlatform
}

declare class Container extends React.Component<Props> {}
export default Container
