/** @jest-environment jsdom */
/// <reference types="jest" />

jest.mock('react-native', () => ({
  ...(jest.requireActual('react-native') as object),
  // the theme module calls this at load time when isIOS is set
  DynamicColorIOS: (p: {light: string}) => p.light,
}))

import * as Styles from '@/styles'
import type {NativeStackHeaderItem} from '@react-navigation/native-stack'

type MutableGlobals = {isIOS: boolean; isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

import type * as HeaderButtons from './header-buttons'

type Buttons = typeof HeaderButtons

// isIOS is read at module scope for modalBackLeftOptions, and at call time inside
// doneModalOptions, so both need the platform globals set around the work.
const withPlatform = <R,>(platform: {isIOS: boolean; isMobile: boolean}, run: () => R): R => {
  const {isIOS, isMobile} = g
  g.isIOS = platform.isIOS
  g.isMobile = platform.isMobile
  try {
    return run()
  } finally {
    g.isIOS = isIOS
    g.isMobile = isMobile
  }
}

const loadFor = (platform: {isIOS: boolean; isMobile: boolean}): Buttons =>
  withPlatform(platform, () => {
    let mod!: Buttons
    jest.isolateModules(() => {
      mod = require('./header-buttons') as Buttons
    })
    return mod
  })

const platforms = {
  android: {isIOS: false, isMobile: true},
  desktop: {isIOS: false, isMobile: false},
  ios: {isIOS: true, isMobile: true},
} as const

const buttons = require('./header-buttons') as Buttons

const asButton = (item: NativeStackHeaderItem) => item as Extract<NativeStackHeaderItem, {type: 'button'}>

describe('native header items', () => {
  test('nativeTextHeaderItem builds a labeled bar button', () => {
    const onPress = jest.fn()
    const item = asButton(buttons.nativeTextHeaderItem('Save', onPress))
    expect(item.type).toBe('button')
    expect(item.label).toBe('Save')
    expect(item.onPress).toBe(onPress)
    expect(item.labelStyle).toEqual({
      color: Styles.getTheme().blueDark,
      fontFamily: 'Keybase',
      fontSize: 17,
      fontWeight: '600',
    })
  })

  test('nativeTextHeaderItem opts override the defaults', () => {
    const item = asButton(buttons.nativeTextHeaderItem('Save', jest.fn(), {disabled: true, label: 'Nope'}))
    expect(item.disabled).toBe(true)
    expect(item.label).toBe('Nope')
  })

  test('nativeIconHeaderItem carries an sfSymbol icon and a label for accessibility', () => {
    const onPress = jest.fn()
    const item = asButton(buttons.nativeIconHeaderItem('gear', 'Settings', onPress))
    expect(item.icon).toEqual({name: 'gear', type: 'sfSymbol'})
    expect(item.label).toBe('Settings')
    expect(item.tintColor).toBe(Styles.getTheme().black_50)
    expect(item.onPress).toBe(onPress)
  })

  test('back and cancel items default to navigating up but accept an override', () => {
    const mod = buttons
    const back = asButton(mod.nativeBackHeaderItem())
    expect(back.icon).toEqual({name: 'chevron.backward', type: 'sfSymbol'})
    expect(back.label).toBe('Back')
    expect(typeof back.onPress).toBe('function')

    const cancel = asButton(mod.nativeCancelHeaderItem())
    expect(cancel.label).toBe('Cancel')
    expect(typeof cancel.onPress).toBe('function')

    const onPress = jest.fn()
    expect(asButton(mod.nativeBackHeaderItem(onPress)).onPress).toBe(onPress)
    expect(asButton(mod.nativeCancelHeaderItem(onPress)).onPress).toBe(onPress)
  })

  test('label styles use the link color and the Keybase font', () => {
    const theme = Styles.getTheme()
    expect(buttons.nativeHeaderItemLabelStyle(theme)).toEqual({
      color: theme.blueDark,
      fontFamily: 'Keybase',
      fontSize: 17,
      fontWeight: '600',
    })
  })
})

describe('modalBackLeftOptions', () => {
  test('iOS uses a single native left bar item, which auto-hides the native back', () => {
    const opts = loadFor(platforms.ios).modalBackLeftOptions as {
      unstable_headerLeftItems?: () => Array<NativeStackHeaderItem>
      headerLeft?: unknown
    }
    expect(opts.headerLeft).toBeUndefined()
    const items = opts.unstable_headerLeftItems?.() ?? []
    expect(items).toHaveLength(1)
    expect(asButton(items[0]!).label).toBe('Back')
  })

  test('other platforms keep the custom headerLeft component', () => {
    const opts = loadFor(platforms.android).modalBackLeftOptions as {
      unstable_headerLeftItems?: unknown
      headerLeft?: unknown
    }
    expect(opts.unstable_headerLeftItems).toBeUndefined()
    expect(typeof opts.headerLeft).toBe('function')
  })
})

describe('doneModalOptions', () => {
  test('iOS clears the left slot and puts Done in a native right bar item', () => {
    const opts = withPlatform(platforms.ios, () => buttons.doneModalOptions('Settings')) as {
      title?: string
      headerShown?: boolean
      headerBackVisible?: boolean
      headerLeft?: unknown
      headerRight?: unknown
      unstable_headerLeftItems?: () => Array<NativeStackHeaderItem>
      unstable_headerRightItems?: () => Array<NativeStackHeaderItem>
    }
    expect(opts.title).toBe('Settings')
    expect(opts.unstable_headerLeftItems?.()).toEqual([])
    const rightItems = opts.unstable_headerRightItems?.() ?? []
    expect(asButton(rightItems[0]!).label).toBe('Done')
    expect(opts.headerLeft).toBeUndefined()
    expect(opts.headerRight).toBeUndefined()
    expect(opts.headerShown).toBe(true)
    expect(opts.headerBackVisible).toBe(false)
  })

  test('android uses components for both slots and still forces the header shown', () => {
    const opts = withPlatform(platforms.android, () => buttons.doneModalOptions('Settings')) as {
      headerLeft?: () => unknown
      headerRight?: unknown
      headerShown?: boolean
      unstable_headerLeftItems?: unknown
    }
    expect(opts.headerLeft?.()).toBeNull()
    expect(typeof opts.headerRight).toBe('function')
    expect(opts.unstable_headerLeftItems).toBeUndefined()
    expect(opts.headerShown).toBe(true)
  })

  test('desktop draws its own header so headerShown is left alone', () => {
    const opts = withPlatform(platforms.desktop, () => buttons.doneModalOptions('Settings')) as {
      headerShown?: boolean
      title?: string
    }
    expect(opts.headerShown).toBeUndefined()
    expect(opts.title).toBe('Settings')
  })
})
