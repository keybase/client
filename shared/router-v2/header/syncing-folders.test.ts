/// <reference types="jest" />
import * as Kb from '@/common-adapters'
import {hasDarkBackground} from './syncing-folders'

const theme = Kb.Styles.getTheme()

describe('hasDarkBackground', () => {
  test('a header with no background of its own is the light one', () => {
    expect(hasDarkBackground(undefined, theme)).toBe(false)
  })

  test('the plain backgrounds are light', () => {
    expect(hasDarkBackground(theme.white, theme)).toBe(false)
    expect(hasDarkBackground(theme.transparent, theme)).toBe(false)
  })

  test('any other background a route sets is dark', () => {
    expect(hasDarkBackground(theme.blue, theme)).toBe(true)
  })
})
