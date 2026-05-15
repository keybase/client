import type * as React from 'react'
import type * as Styles from '@/styles'

type Props = {
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
}
const RenderChildren = (props: Props): React.ReactNode => props.children || null
export const useSafeAreaInsets = () => ({
  bottom: 0,
  left: 0,
  right: 0,
  top: 0,
})

// Do nothing
export {RenderChildren as default, RenderChildren as SafeAreaViewTop}
