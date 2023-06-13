// normally util.container but it re-exports from us so break the cycle
import * as RPCTypes from './types/rpc-gen'
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

export type DarkModePreference = 'system' | 'alwaysDark' | 'alwaysLight'

export type ZStore = {
  darkModePreference: DarkModePreference
  systemDarkMode: boolean
  supported: boolean
}

const initialState: ZStore = {
  darkModePreference: 'system',
  supported: false,
  systemDarkMode: false,
}

type ZState = ZStore & {
  isDarkMode: () => boolean
  dispatch: {
    loadDarkPrefs: () => void
    setDarkModePreference: (p: DarkModePreference) => void
    setSystemDarkMode: (dark: boolean) => void
    setSystemSupported: (s: boolean) => void
  }
}

const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

export const useDarkModeState = createZustand(
  immerZustand<ZState>((set, get) => {
    const dispatch = {
      loadDarkPrefs: () => {
        const f = async () => {
          const v = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.darkMode'})
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
        }
        ignorePromise(f())
      },
      reset: () => {
        set(s => ({
          ...initialState,
          darkModePreference: s.darkModePreference,
        }))
      },
      setDarkModePreference: (p: DarkModePreference) => {
        set(s => {
          s.darkModePreference = p
        })
        const f = async () => {
          await RPCTypes.configGuiSetValueRpcPromise({
            path: 'ui.darkMode',
            value: {isNull: false, s: p},
          })
        }
        ignorePromise(f())
      },
      setSystemDarkMode: (dark: boolean) => {
        set(s => {
          s.systemDarkMode = dark
        })
      },
      setSystemSupported: (sup: boolean) => {
        set(s => {
          s.supported = sup
        })
      },
    }

    return {
      ...initialState,
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
)
