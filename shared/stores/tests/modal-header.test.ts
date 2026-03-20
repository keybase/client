import {resetAllStores} from '@/util/zustand'
import {useModalHeaderState} from '../modal-header'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('resetState restores the modal header defaults', () => {
  const store = useModalHeaderState

  store.setState(
    {
      ...store.getState(),
      actionEnabled: true,
      actionWaiting: true,
      botInTeam: true,
      botReadOnly: true,
      botSubScreen: 'install',
      data: {id: 1},
      editAvatarHasImage: true,
      onAction: () => undefined,
      title: 'custom title',
    },
    true
  )

  store.getState().dispatch.resetState()

  expect(store.getState().actionEnabled).toBe(false)
  expect(store.getState().actionWaiting).toBe(false)
  expect(store.getState().botSubScreen).toBe('')
  expect(store.getState().data).toBeUndefined()
  expect(store.getState().title).toBe('')
})
