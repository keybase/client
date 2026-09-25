import * as React from 'react'
import type {SharedValue} from 'react-native-reanimated'
import {computeComposerBox, type ComposerBox} from './composer-geometry'

/**
 * Where the composer's bottom edge sits and how the keyboard moves it. Nothing
 * here is derived from layout, so this object's identity survives every
 * measurement of the conversation box — which is what keeps the message list
 * from re-rendering when the box is measured. Do not add layout-derived fields.
 */
export type ComposerAnchor = {
  /** Bottom safe-area inset. */
  bottomInset: number
  /** reanimated's keyboard offset: 0 while closed, negative while open. */
  keyboardHeight: SharedValue<number>
  /** 0 (keyboard closed) to 1 (keyboard fully open). */
  keyboardProgress: SharedValue<number>
}

// no default: the keyboard values are real shared values that only a
// conversation owns, and a stand-in would silently pin the list and the input
// to a closed keyboard and a zero inset
const ComposerAnchorContext = React.createContext<ComposerAnchor | null>(null)
ComposerAnchorContext.displayName = 'ComposerAnchorContext'

export const useComposerAnchor = () => {
  const anchor = React.useContext(ComposerAnchorContext)
  if (!anchor) {
    throw new Error('useComposerAnchor must be used inside a ComposerProvider')
  }
  return anchor
}

/**
 * The measured conversation box and every size derived from it. Changes identity
 * on first layout and on rotation, so only the composer's own panels should read
 * it; anything that just needs the bottom edge reads the anchor.
 *
 * The default is the pre-layout box, so a consumer rendered outside a
 * conversation (the desktop command-markdown panel) gets the same fallbacks it
 * would get before the box is measured.
 */
export const ComposerBoxContext = React.createContext<ComposerBox>(computeComposerBox(0))
ComposerBoxContext.displayName = 'ComposerBoxContext'

type ComposerProviderProps = ComposerAnchor & {
  /** onLayout height of the conversation box. 0 until it has been laid out. */
  measuredHeight: number
  children: React.ReactNode
}

/**
 * Publishes the anchor and the box as two separately memoized values, split on
 * whether they are layout-derived: the message list reads only the anchor, so
 * measuring the box must not change the anchor's identity. Merging them costs a
 * list render on every mount and rotation.
 */
export const ComposerProvider = (p: ComposerProviderProps) => {
  const {bottomInset, keyboardHeight, keyboardProgress, measuredHeight, children} = p
  const anchor = React.useMemo<ComposerAnchor>(
    () => ({bottomInset, keyboardHeight, keyboardProgress}),
    [bottomInset, keyboardHeight, keyboardProgress]
  )
  const box = React.useMemo(() => computeComposerBox(measuredHeight), [measuredHeight])
  return (
    <ComposerAnchorContext value={anchor}>
      <ComposerBoxContext value={box}>{children}</ComposerBoxContext>
    </ComposerAnchorContext>
  )
}
