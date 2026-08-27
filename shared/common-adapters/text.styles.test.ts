/// <reference types="jest" />

import {expect, test, describe} from '@jest/globals'
import * as Styles from '@/styles'
import type * as TextStyles from './text.styles'
import {getTextStyle} from './text.styles'
import {linkTypes, backgroundModeIsNegative, type TextType} from './text.shared'

const theme = Styles.getTheme()

const allTypes: ReadonlyArray<TextType> = [
  'Body',
  'BodyItalic',
  'BodyBig',
  'BodyBigExtrabold',
  'BodyBigLink',
  'BodyBold',
  'BodyExtrabold',
  'BodyPrimaryLink',
  'BodySecondaryLink',
  'BodySemibold',
  'BodySemiboldLink',
  'BodySemiboldItalic',
  'BodySmall',
  'BodySmallBold',
  'BodySmallExtrabold',
  'BodySmallExtraboldSecondaryLink',
  'BodySmallError',
  'BodySmallItalic',
  'BodySmallPrimaryLink',
  'BodySmallSecondaryLink',
  'BodySmallSemibold',
  'BodySmallSemiboldItalic',
  'BodySmallSemiboldSecondaryLink',
  'BodySmallSemiboldPrimaryLink',
  'BodySmallSuccess',
  'BodySmallWallet',
  'BodyTiny',
  'BodyTinyLink',
  'BodyTinySemibold',
  'BodyTinySemiboldItalic',
  'BodyTinyBold',
  'BodyTinyExtrabold',
  'Header',
  'HeaderItalic',
  'HeaderExtrabold',
  'HeaderBig',
  'HeaderBigExtrabold',
  'HeaderLink',
  'Terminal',
  'TerminalComment',
  'TerminalEmpty',
  'TerminalInline',
]

describe('getTextStyle', () => {
  test('every text type resolves a font size, line height and color', () => {
    for (const type of allTypes) {
      const style = getTextStyle(type, theme) as Record<string, unknown>
      expect(typeof style['fontSize']).toBe('number')
      // desktop line heights are px strings, native ones are numbers
      expect(String(style['lineHeight'])).toMatch(/^\d+(px)?$/)
      expect(typeof style['color']).toBe('string')
    }
  })

  test('link types get a pointer cursor on desktop and non-links do not', () => {
    for (const type of allTypes) {
      const style = getTextStyle(type, theme) as Record<string, unknown>
      if (linkTypes.has(type)) {
        expect(style['cursor']).toBe('pointer')
      } else {
        expect(style['cursor']).toBeUndefined()
      }
    }
  })

  test('every declared link type is a real text type', () => {
    for (const type of linkTypes) {
      expect(allTypes).toContain(type)
    }
  })

  test('sizes are ordered tiny < small < body < big < header < headerBig', () => {
    const size = (t: TextType) => (getTextStyle(t, theme) as {fontSize?: number}).fontSize ?? 0
    expect(size('BodyTiny')).toBeLessThan(size('BodySmall'))
    expect(size('BodySmall')).toBeLessThan(size('Body'))
    expect(size('Body')).toBeLessThan(size('BodyBig'))
    expect(size('BodyBig')).toBeLessThan(size('Header'))
    expect(size('Header')).toBeLessThan(size('HeaderBig'))
  })

  test('terminal types carry the terminal style override', () => {
    const style = getTextStyle('TerminalInline', theme) as Record<string, unknown>
    expect(style['borderRadius']).toBe(2)
    expect(style['padding']).toBe(2)
    expect(style['backgroundColor']).toBe(theme.blueLighter2)
  })

  test('native metadata resolves numeric line heights for every type', () => {
    const g = globalThis as unknown as {isMobile: boolean}
    g.isMobile = true
    try {
      jest.isolateModules(() => {
        const native = require('./text.styles') as typeof TextStyles
        for (const type of allTypes) {
          const style = native.getTextStyle(type, theme) as Record<string, unknown>
          expect(typeof style['fontSize']).toBe('number')
          expect(typeof style['lineHeight']).toBe('number')
          expect(typeof style['color']).toBe('string')
          // cursor is a desktop-only concept
          expect(style['cursor']).toBeUndefined()
        }
      })
    } finally {
      g.isMobile = false
    }
  })

  test('bold-ish variants differ from their regular counterpart only in weight-related keys', () => {
    const body = getTextStyle('Body', theme) as Record<string, unknown>
    const bold = getTextStyle('BodyBold', theme) as Record<string, unknown>
    expect(bold['fontSize']).toBe(body['fontSize'])
    expect(bold['lineHeight']).toBe(body['lineHeight'])
    expect(bold['fontFamily'] ?? bold['fontWeight']).not.toEqual(undefined)
  })
})

describe('backgroundModeIsNegative', () => {
  test('undefined background is not negative', () => {
    expect(backgroundModeIsNegative(undefined)).toBe(false)
  })

  test('Normal and Information are positive backgrounds', () => {
    expect(backgroundModeIsNegative('Normal')).toBe(false)
    expect(backgroundModeIsNegative('Information')).toBe(false)
  })

  test('all other backgrounds are negative', () => {
    for (const bm of ['Announcements', 'Documentation', 'HighRisk', 'Success', 'Terminal'] as const) {
      expect(backgroundModeIsNegative(bm)).toBe(true)
    }
  })
})
