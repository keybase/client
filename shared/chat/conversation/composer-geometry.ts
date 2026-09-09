// Geometry of the mobile composer: the box the conversation occupies under the
// navigation header, and everything sized from it — the expandable text input,
// the suggestion popup, the command-markdown panel, and the offsets that keep
// anything pinned to the input bar lined up with it.
//
// Split deliberately in two. computeComposerBox depends on the measured layout,
// so its result changes identity on mount and rotation; the sticky offset and
// the keyboard values do not. They are published as separate contexts so the
// message list, which reads only the latter, does not re-render every time the
// conversation box is measured. Keep that seam: anything layout-derived belongs
// in the box, anything stable belongs beside the offset.
//
// Dependency-free on purpose: the keyboard-driven helpers below run as
// reanimated worklets on the UI thread, so they may only touch their arguments
// and the constants in this file.

/** Collapsed height of the text input. */
const singleLineHeight = 36
/** Height of the text input when it is not expanded but has grown. */
const threeLineHeight = 78
/** Height of the button row under the text input, plus its padding. */
const composerBarHeight = 91
/** Slack left between an expanded input and the top of the conversation box. */
const expandedInputTopGap = 15
/** Share of the conversation box a panel stacked above the input may cover. */
const composerPanelHeightRatio = 0.35
const minExpandedSuggestionListHeight = 120
const maxExpandedSuggestionListHeight = 240
/**
 * Used until the conversation reports its height; the markdown mounts long after
 * layout, so this is only a backstop against an unbounded body.
 */
const commandMarkdownFallbackMaxHeight = 250

export type ComposerBoxInput = {
  /** Height of the window inside the safe area. */
  windowHeight: number
  /** The navigator's measured header height (top inset included). */
  headerHeight: number
  /** onLayout height of the conversation box. 0 until it has been laid out. */
  measuredHeight: number
}

export type ComposerBox = {
  /** Height to give the conversation box: the window minus the header. */
  containerHeight: number
  /**
   * The conversation box as actually laid out; 0 before the first layout, which
   * is why every consumer has a fallback. Panels stacked over the input are
   * sized from this rather than from `containerHeight` so they track the box
   * that really got rendered.
   */
  visibleHeight: number
  /** Collapsed height of the text input. */
  singleLineHeight: number
  /** Height of the text input when it is not expanded but has grown. */
  threeLineHeight: number
  /** maxHeight of the suggestion list rendered inside an expanded input. */
  expandedSuggestionListHeight: number
  /** maxHeight of the command-markdown panel above the input. */
  commandMarkdownMaxHeight: number
}

/**
 * KeyboardStickyView offset for the input bar and anything that has to sit on
 * top of it: the bar rides `bottomInset` above the window bottom while the
 * keyboard is closed, and flush against the keyboard while it is open.
 */
export const composerStickyOffset = (bottomInset: number) => ({closed: -bottomInset, opened: 0})

export const computeComposerBox = ({
  windowHeight,
  headerHeight,
  measuredHeight,
}: ComposerBoxInput): ComposerBox => {
  const visibleHeight = measuredHeight
  const panelHeight = Math.floor(visibleHeight * composerPanelHeightRatio)
  // an expanded input keeps at least three lines for itself, so the suggestion
  // list can never claim more than what is left over above it
  const suggestionReserve = Math.max(
    0,
    visibleHeight - composerBarHeight - expandedInputTopGap - threeLineHeight
  )
  const preferredSuggestionListHeight = visibleHeight
    ? Math.max(
        minExpandedSuggestionListHeight,
        Math.min(maxExpandedSuggestionListHeight, panelHeight)
      )
    : 0

  return {
    // deliberately unclamped, unlike the suggestion list: this panel scrolls, so
    // a short conversation box should shrink it rather than hold a 120pt floor
    commandMarkdownMaxHeight: visibleHeight ? panelHeight : commandMarkdownFallbackMaxHeight,
    containerHeight: windowHeight - headerHeight,
    expandedSuggestionListHeight: Math.min(preferredSuggestionListHeight, suggestionReserve),
    singleLineHeight,
    threeLineHeight,
    visibleHeight,
  }
}

/**
 * Height of the area a popup anchored to the input bar may fill: the
 * conversation box, less whatever the keyboard covers. `keyboardHeight` is
 * reanimated's keyboard offset, which is 0 closed and negative while open.
 * undefined until the box has been laid out, so the popup stays unconstrained
 * rather than collapsing to 0.
 */
export const suggestionAreaHeight = (visibleHeight: number, keyboardHeight: number) => {
  'worklet'
  return visibleHeight ? Math.max(0, visibleHeight + keyboardHeight) : undefined
}

/**
 * maxHeight of the expanded text input. The input is pinned above the keyboard,
 * so the room it can grow into shrinks by the keyboard height, and by whatever
 * the suggestion list has reserved above it.
 */
export const expandedInputMaxHeight = (
  visibleHeight: number,
  keyboardHeight: number,
  reservedHeight: number
) => {
  'worklet'
  return Math.max(
    threeLineHeight,
    visibleHeight + keyboardHeight - composerBarHeight - expandedInputTopGap - reservedHeight
  )
}

/**
 * The translation `stickyOffset` produces, for views that have to mirror the
 * input bar's position by hand instead of living in a KeyboardStickyView.
 * `keyboardProgress` runs 0 (closed) to 1 (open).
 */
export const stickyTranslateY = (
  bottomInset: number,
  keyboardHeight: number,
  keyboardProgress: number
) => {
  'worklet'
  return keyboardHeight - bottomInset * (1 - keyboardProgress)
}

/**
 * Scroll offset the inverted message list rests at. KeyboardChatScrollView sets
 * contentInset.top = K - bottomInset and contentOffset.y = -(K - bottomInset)
 * while the keyboard is open, so scrolling to 0 would drop the newest message
 * behind the keyboard.
 */
export const restingScrollOffset = (bottomInset: number, keyboardHeight: number) => {
  'worklet'
  return Math.min(keyboardHeight + bottomInset, 0)
}
