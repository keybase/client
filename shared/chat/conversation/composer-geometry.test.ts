/// <reference types="jest" />
import {
  composerStickyOffset,
  computeComposerBox,
  expandedInputMaxHeight,
  restingScrollOffset,
  stickyTranslateY,
} from './composer-geometry'

// The numbers below are literal pixel results, not re-derived from the
// constants: every one of them encodes a shipped fix (the suggestion popup
// clipping its last row, the list jumping on keyboard dismiss, the giphy popup
// resizing), so a change to the model has to be spelled out here.

describe('composerStickyOffset', () => {
  test('lifts by the bottom inset only while the keyboard is closed', () => {
    expect(composerStickyOffset(34)).toEqual({closed: -34, opened: 0})
    expect(composerStickyOffset(0)).toEqual({closed: -0, opened: 0})
  })
})

describe('computeComposerBox', () => {
  test('publishes the measured box, 0 until it has been laid out', () => {
    expect(computeComposerBox(700).visibleHeight).toBe(700)
    expect(computeComposerBox(0).visibleHeight).toBe(0)
  })

  describe('expandedSuggestionListHeight', () => {
    test('takes 35% of the box, clamped to [120, 240]', () => {
      // 753 * 0.35 = 263.55 -> floored to 263 -> clamped to 240
      expect(computeComposerBox(753).expandedSuggestionListHeight).toBe(240)
      // 600 * 0.35 = 210, and 600 leaves 416 of reserve, so 210 stands
      expect(computeComposerBox(600).expandedSuggestionListHeight).toBe(210)
    })

    test('never eats the three lines the expanded input keeps for itself', () => {
      // 400 - 91 (bar) - 15 (gap) - 78 (three lines) = 216 of reserve, more than
      // the 400*0.35=140 preference, so the preference still stands
      expect(computeComposerBox(400).expandedSuggestionListHeight).toBe(140)
      // 200 leaves only 16 of reserve; the 120 floor must not push past it
      expect(computeComposerBox(200).expandedSuggestionListHeight).toBe(16)
      // and a box smaller than the input itself reserves nothing
      expect(computeComposerBox(100).expandedSuggestionListHeight).toBe(0)
    })

    test('is 0 before the box has been laid out', () => {
      expect(computeComposerBox(0).expandedSuggestionListHeight).toBe(0)
    })
  })

  describe('commandMarkdownMaxHeight', () => {
    test('takes the same 35% of the box, but unclamped', () => {
      expect(computeComposerBox(753).commandMarkdownMaxHeight).toBe(263)
      // deliberately below the suggestion list's 120 floor: this panel scrolls
      expect(computeComposerBox(200).commandMarkdownMaxHeight).toBe(70)
    })

    test('falls back to a fixed backstop before layout', () => {
      // it mounts long after layout, so 0 here means "no measurement yet"
      expect(computeComposerBox(0).commandMarkdownMaxHeight).toBe(250)
    })
  })
})

describe('expandedInputMaxHeight', () => {
  test('fills the box minus the bar, the gap and anything reserved above it', () => {
    // 753 - 91 - 15 = 647
    expect(expandedInputMaxHeight(753, 0, 0)).toBe(647)
    // keyboard up: 753 - 336 - 91 - 15 = 311
    expect(expandedInputMaxHeight(753, -336, 0)).toBe(311)
    // with a 200pt suggestion list reserved above it
    expect(expandedInputMaxHeight(753, -336, 200)).toBe(111)
  })

  test('never drops below three lines', () => {
    expect(expandedInputMaxHeight(753, -336, 600)).toBe(78)
    expect(expandedInputMaxHeight(0, 0, 0)).toBe(78)
  })
})

describe('stickyTranslateY', () => {
  test('matches the sticky offset at both ends of the keyboard transition', () => {
    const stickyOffset = composerStickyOffset(34)
    expect(stickyTranslateY(34, 0, 0)).toBe(stickyOffset.closed)
    expect(stickyTranslateY(34, -336, 1)).toBe(-336 + stickyOffset.opened)
  })

  test('interpolates the inset away as the keyboard opens', () => {
    expect(stickyTranslateY(34, -168, 0.5)).toBe(-185)
  })

  test('extrapolates past both ends rather than clamping', () => {
    // reanimated's interpolate defaults to EXTEND, and the keyboard's progress
    // overshoots on a spring; clamping here would desync the jump button from
    // the bar it is supposed to rest on
    expect(stickyTranslateY(34, 0, -0.5)).toBe(-51)
    expect(stickyTranslateY(34, 0, 1.5)).toBe(17)
  })
})

describe('restingScrollOffset', () => {
  test('lands the newest message above the keyboard', () => {
    expect(restingScrollOffset(34, -336)).toBe(-302)
  })

  test('clamps to 0 so a closed keyboard cannot push content down', () => {
    expect(restingScrollOffset(34, 0)).toBe(0)
    expect(restingScrollOffset(34, -20)).toBe(0)
  })
})
