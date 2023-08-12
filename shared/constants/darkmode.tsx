import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'

export type DarkModePreference = 'system' | 'alwaysDark' | 'alwaysLight'

export type Store = {
  darkModePreference: DarkModePreference
  systemDarkMode: boolean
  supported: boolean
}

const initialStore: Store = {
  darkModePreference: 'system',
  supported: false,
  systemDarkMode: false,
}

type State = Store & {
  isDarkMode: () => boolean
  dispatch: {
    loadDarkPrefs: () => void
    resetState: () => void
    setDarkModePreference: (p: DarkModePreference) => void
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
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        darkModePreference: s.darkModePreference,
      }))
    },
    setDarkModePreference: p => {
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
