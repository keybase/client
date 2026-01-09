import * as T from '@/constants/types'
import type * as Constants from '@/stores/pinentry'
import {produce} from 'immer'

export type ProxyProps = {
  darkMode: boolean
} & Constants.Store

export type SerializeProps = ProxyProps
export type DeserializeProps = ProxyProps

const initialState: DeserializeProps = {
  darkMode: false,
  prompt: '',
  showTyping: {
    allow: false,
    defaultValue: false,
    label: '',
    readonly: false,
  },
  type: T.RPCGen.PassphraseType.none,
  windowTitle: '',
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => p

export const deserialize = (
  state: DeserializeProps = initialState,
  props?: Partial<SerializeProps>
): DeserializeProps => {
  if (!props) return state
  const {darkMode, prompt, showTyping, type, windowTitle} = props
  return produce(state, s => {
    if (darkMode !== undefined) {
      s.darkMode = darkMode
    }
    if (prompt !== undefined) {
      s.prompt = prompt
    }
    if (showTyping !== undefined) {
      if (s.showTyping) {
        s.showTyping.allow = showTyping.allow
        s.showTyping.defaultValue = showTyping.defaultValue
        s.showTyping.label = showTyping.label
        s.showTyping.readonly = showTyping.readonly
      } else {
        s.showTyping = showTyping
      }
    }
    if (type !== undefined) {
      s.type = type
    }
    if (windowTitle !== undefined) {
      s.windowTitle = windowTitle
    }
  })
}
