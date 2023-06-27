import * as Z from '../util/zustand'
import type * as RPCGen from './types/rpc-gen'
import type * as Types from './types/profile'

export const makeInitialState = (): Types.State => ({
  pgpEmail1: '',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpErrorEmail1: false,
  pgpErrorEmail2: false,
  pgpErrorEmail3: false,
  pgpErrorText: '',
  pgpFullName: '',
  pgpPublicKey: '',
  platformGenericChecking: false,
  promptShouldStoreKeyOnServer: false,
  proofFound: false,
  proofText: '',
  revokeError: '',
  searchShowingSuggestions: false,
  username: '',
  usernameValid: true,
  wotAuthorError: '',
})

export const makeProveGenericParams = (): Types.ProveGenericParams => ({
  buttonLabel: '',
  logoBlack: [],
  logoFull: [],
  subtext: '',
  suffix: '',
  title: '',
})

export const toProveGenericParams = (p: RPCGen.ProveParameters): Types.ProveGenericParams => ({
  ...makeProveGenericParams(),
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

export const waitingKey = 'profile:waiting'
export const uploadAvatarWaitingKey = 'profile:uploadAvatar'
export const blockUserWaitingKey = 'profile:blockUser'
export const wotAuthorWaitingKey = 'profile:wotAuthor'
export const AVATAR_SIZE = 128

type Store = {
  errorCode?: number
  errorText: string
}
const initialStore: Store = {
  errorCode: undefined,
  errorText: '',
}

type State = Store & {
  dispatch: {
    resetState: 'default'
  }
}

// TODO
// [ProfileGen.updateErrorText]: (draftState, action) => {
//   draftState.errorCode = action.payload.errorCode
//   draftState.errorText = action.payload.errorText
// },
export const useState = Z.createZustand<State>(_set => {
  const clearErrors = (s: Store) => {
    s.errorCode = undefined
    s.errorText = ''
  }
  const dispatch: State['dispatch'] = {
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
