import * as React from 'react'
import type * as Styles from '../styles'

export type Props = {
  color: 'green' | 'blue' | 'red'
  on: boolean
  style?: Styles.StylesCrossPlatform | null
}

declare class SwitchToggle extends React.PureComponent<Props> {}
export default SwitchToggle
