import * as T from './types'
import * as Z from '@/util/zustand'
import {Appearance} from 'react-native'
import {isMobile} from './platform'

export type DarkModePreference = 'system' | 'alwaysDark' | 'alwaysLight'

export type Store = T.Immutable<{
  darkModePreference: DarkModePreference
  systemDarkMode: boolean
  supported: boolean
}>

const initialStore: Store = {
  darkModePreference: 'system',
  supported: false,
  systemDarkMode: false,
}

interface State extends Store {
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

export const _useState = Z.createZustand<State>((set, get) => {
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
