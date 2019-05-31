import * as I from 'immutable'

export type _State = {
  dumbFilter: string
  dumbFullscreen: boolean
  dumbIndex: number
  debugCount: number
}

export type State = I.RecordOf<_State>
