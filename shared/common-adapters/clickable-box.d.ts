import type * as React from 'react'
import type * as Styles from '@/styles'
import type {MeasureRef} from './measure-ref'
export type Props = {
  className?: string | undefined
  children?: React.ReactNode | undefined
  style?: Styles.StylesCrossPlatform | undefined
  onClick?: ((event: React.BaseSyntheticEvent) => void) | undefined
  onDoubleClick?: ((event: React.BaseSyntheticEvent) => void) | undefined
  onPress?: never
  onLongPress?: ((event: React.BaseSyntheticEvent) => void) | undefined
  underlayColor?: string | undefined
  onPressIn?: (() => void) | undefined
  onPressOut?: (() => void) | undefined
  // mobile only
  feedback?: boolean | undefined
  activeOpacity?: number | undefined
  // desktop only
  hoverColor?: string | undefined
  onMouseOver?: ((event: React.MouseEvent) => void) | undefined
  onMouseEnter?: ((event: React.MouseEvent) => void) | undefined
  onMouseLeave?: ((event: React.MouseEvent) => void) | undefined
  onMouseDown?: ((event: React.MouseEvent) => void) | undefined
  onMouseMove?: ((event: React.MouseEvent) => void) | undefined
  onMouseUp?: ((event: React.MouseEvent) => void) | undefined
  title?: string | undefined
  tooltip?: string | undefined
}

export type Props2 = {
  // mobile only
  onLongPress?: (() => void) | undefined
  hitSlop?: number | undefined
  testID?: string | undefined
  // desktop only
  onMouseOver?: ((event: React.MouseEvent) => void) | undefined

  onClick?: (() => void) | undefined
  children: React.ReactNode
  className?: string | undefined
  style?: Styles.StylesCrossPlatform | undefined
}

export declare function ClickableBox(props: Props & {ref?: React.Ref<MeasureRef> | undefined}): React.ReactNode
export declare function ClickableBox2(props: Props2 & {ref?: React.Ref<MeasureRef | null> | undefined}): React.ReactNode
export default ClickableBox
