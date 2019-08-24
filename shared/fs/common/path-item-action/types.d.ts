import * as React from 'react'
import * as Styles from '../../../styles'

export type FloatingMenuProps = {
  containerStyle?: Styles.StylesCrossPlatform | null
  hideOnce: () => void
  visible: boolean
  attachTo?: () => React.Component<any> | null
}
