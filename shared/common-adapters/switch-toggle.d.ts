import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  color: 'green' | 'blue'
  on: boolean
  style?: Styles.StylesCrossPlatform | null
}

declare class SwitchToggle extends React.PureComponent<Props> {}
export default SwitchToggle
