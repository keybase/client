import * as Z from '@/util/zustand'

type Store = {
  actionEnabled: boolean
  actionWaiting: boolean
  botInTeam: boolean
  botReadOnly: boolean
  botSubScreen: '' | 'install' | 'channels'
  data: unknown
  editAvatarHasImage: boolean
  onAction: (() => void) | undefined
  title: string
}

const initialStore: Store = {
  actionEnabled: false,
  actionWaiting: false,
  botInTeam: false,
  botReadOnly: false,
  botSubScreen: '',
  data: undefined,
  editAvatarHasImage: false,
  onAction: undefined,
  title: '',
}

export interface State extends Store {
  dispatch: {
    resetState: 'default'
  }
}

export const useModalHeaderState = Z.createZustand<State>('modal-header', () => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
