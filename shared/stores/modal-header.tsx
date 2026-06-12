import * as Z from '@/util/zustand'

// Bridges action-button/title state between a mounted modal screen body and
// its navigation header (headerRight/headerTitle render outside the screen's
// component tree, so React context can't span the two).
type Store = {
  actionEnabled: boolean
  actionWaiting: boolean
  botInTeam: boolean
  botReadOnly: boolean
  botSubScreen: '' | 'install' | 'channels'
  onAction: (() => void) | undefined
  title: string
}

const initialStore: Store = {
  actionEnabled: false,
  actionWaiting: false,
  botInTeam: false,
  botReadOnly: false,
  botSubScreen: '',
  onAction: undefined,
  title: '',
}

export type State = Store & {
  dispatch: {
    resetState: () => void
  }
}

export const useModalHeaderState = Z.createZustand<State>('modal-header', () => {
  const dispatch: State['dispatch'] = {
    resetState: Z.defaultReset,
  }
  return {
    ...initialStore,
    dispatch,
  }
})
