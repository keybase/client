import * as React from 'react'
import type {SharedValue} from 'react-native-reanimated'
import {composerStickyOffset, computeComposerBox, type ComposerBox} from './composer-geometry'

/**
 * Where the composer's bottom edge sits and how the keyboard moves it. Nothing
 * here is derived from layout, so this object's identity survives every
 * measurement of the conversation box — which is what keeps the message list
 * from re-rendering when the box is measured. Do not add layout-derived fields.
 */
export type ComposerAnchor = {
  /** Bottom safe-area inset. */
  bottomInset: number
  /** See composerStickyOffset. */
  stickyOffset: {closed: number; opened: number}
  /** reanimated's keyboard offset: 0 while closed, negative while open. */
  keyboardHeight: SharedValue<number>
  /** 0 (keyboard closed) to 1 (keyboard fully open). */
  keyboardProgress: SharedValue<number>
}

// Only reached off-mobile, or by a consumer mounted outside a conversation: no
// worklet ever runs there, so a plain object standing in for a shared value is
// enough (this is what the reanimated adapter's own non-mobile mock does).
const zeroShared = {
  addListener: () => {},
  get: () => 0,
  modify: () => {},
  removeListener: () => {},
  set: () => {},
  value: 0,
} as unknown as SharedValue<number>

const emptyAnchor: ComposerAnchor = {
  bottomInset: 0,
  keyboardHeight: zeroShared,
  keyboardProgress: zeroShared,
  stickyOffset: composerStickyOffset(0),
}

export const ComposerAnchorContext = React.createContext<ComposerAnchor>(emptyAnchor)
ComposerAnchorContext.displayName = 'ComposerAnchorContext'

/**
 * The measured conversation box and every size derived from it. Changes identity
 * on first layout and on rotation, so only the composer's own panels should read
 * it; anything that just needs the bottom edge reads ComposerAnchorContext.
 *
 * The default is the pre-layout box, so a consumer rendered outside a
 * conversation gets the same fallbacks it would get before the box is measured.
 */
export const ComposerBoxContext = React.createContext<ComposerBox>(
  computeComposerBox({headerHeight: 0, measuredHeight: 0, windowHeight: 0})
)
ComposerBoxContext.displayName = 'ComposerBoxContext'
