import * as I from 'immutable'
import * as Types from './types/deeplinks'

export const linkIsKeybaseLink = (link: string) => link.startsWith('keybase://')

export const makeState = I.Record<Types._State>({
  keybaseLinkError: '',
})
