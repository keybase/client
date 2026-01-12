import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {Appearance} from 'react-native'
import {isMobile} from '@/constants/platform'

export type DarkModePreference = 'system' | 'alwaysDark' | 'alwaysLight'

// This store has no dependencies on other stores and is safe to import directly from other stores.
type Store = T.Immutable<{
  darkModePreference: DarkModePreference
  systemDarkMode: boolean
  supported: boolean
}>

const initialStore: Store = {
  darkModePreference: 'system',
  supported: false,
  systemDarkMode: false,
}

export interface State extends Store {
  // Not to be used by regular components, useColorScheme instead
  isDarkMode: () => boolean
  dispatch: {
    loadDarkPrefs: () => void
    resetState: () => void
    setDarkModePreference: (p: DarkModePreference, writeToConfig?: boolean) => void
    setSystemDarkMode: (dark: boolean) => void
    setSystemSupported: (s: boolean) => void
  }
}

const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

export const useDarkModeState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    loadDarkPrefs: () => {
      const f = async () => {
        try {
          const v = await T.RPCGen.configGuiGetValueRpcPromise({path: 'ui.darkMode'})
          const preference = v.s
          switch (preference) {
            case 'system':
            case 'alwaysDark': // fallthrough
            case 'alwaysLight': // fallthrough
              set(s => {
                s.darkModePreference = preference
              })
              break
            default:
          }
        } catch {}
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        darkModePreference: s.darkModePreference,
        supported: s.supported,
        systemDarkMode: s.systemDarkMode,
      }))
    },
    setDarkModePreference: (p, writeToConfig = true) => {
      if (isMobile) {
        // update RN so keyboards / etc are correct on the native side
        switch (p) {
          case 'system':
            Appearance.setColorScheme(null)
            break
          case 'alwaysDark':
            Appearance.setColorScheme('dark')
            break
          case 'alwaysLight':
            Appearance.setColorScheme('light')
            break
        }
      } else {
        // update Electron's nativeTheme
        const f = async () => {
          try {
            const {default: KB2} = await import('@/util/electron.desktop')
            switch (p) {
              case 'system':
                await KB2.functions.setNativeTheme?.('system')
                break
              case 'alwaysDark':
                await KB2.functions.setNativeTheme?.('dark')
                break
              case 'alwaysLight':
                await KB2.functions.setNativeTheme?.('light')
                break
            }
          } catch {}
        }
        ignorePromise(f())
      }

      set(s => {
        s.darkModePreference = p
      })

      if (writeToConfig) {
        const f = async () => {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: 'ui.darkMode',
            value: {isNull: false, s: p},
          })
        }
        ignorePromise(f())
      }
    },
    setSystemDarkMode: dark => {
      set(s => {
        s.systemDarkMode = dark
      })
    },
    setSystemSupported: sup => {
      set(s => {
        s.supported = sup
      })
    },
  }

  return {
    ...initialStore,
    dispatch,
    isDarkMode: () => {
      switch (get().darkModePreference) {
        case 'system':
          return get().systemDarkMode
        case 'alwaysDark':
          return true
        case 'alwaysLight':
          return false
      }
    },
  }
})
