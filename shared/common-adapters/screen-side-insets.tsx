import * as React from 'react'
import {StyleSheet} from 'react-native'
import type {StyleProp, ViewStyle} from 'react-native'

// The left/right strips iOS reserves on the current stack screen (iPhone Duo: the status column, and
// in Split View the column of header buttons). Screens lay out on the full window so centered
// content stays centered; scrolling content takes these as padding to keep clear of the strips.
export type ScreenSideInsets = {left: number; right: number}
export const noSideInsets: ScreenSideInsets = {left: 0, right: 0}
export const ScreenSideInsetsContext = React.createContext<ScreenSideInsets>(noSideInsets)
export const useScreenSideInsets = () => React.useContext(ScreenSideInsetsContext)

// `style` with the side insets added to whatever horizontal padding it already has. Unchanged when
// there are no insets, so screens without strips lay out exactly as before.
export const withSideInsets = (
  style: StyleProp<ViewStyle>,
  {left, right}: ScreenSideInsets
): StyleProp<ViewStyle> => {
  if (!left && !right) return style
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle
  const base = (edge: ViewStyle['padding']) => (typeof edge === 'number' ? edge : 0)
  const baseLeft = base(flat.paddingLeft ?? flat.paddingStart ?? flat.paddingHorizontal ?? flat.padding)
  const baseRight = base(flat.paddingRight ?? flat.paddingEnd ?? flat.paddingHorizontal ?? flat.padding)
  return [style, {paddingLeft: baseLeft + left, paddingRight: baseRight + right}]
}
