/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useNavigationIntentsState} from './navigation-intents'

const clearIntent = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
}

afterEach(() => {
  clearIntent()
})

test('acknowledges only the intent that was actually handled', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/first')
  const firstID = useNavigationIntentsState.getState().intent!.id

  dispatch.enqueue('keybase://convid/second')
  dispatch.acknowledge(firstID)

  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/second')
})

test('suppresses a duplicate immediately after it was handled', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/test')
  const intentID = useNavigationIntentsState.getState().intent!.id
  dispatch.acknowledge(intentID)

  dispatch.enqueue('keybase://convid/test')

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('adds account ownership when a targeted duplicate arrives', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/target-enrichment')

  dispatch.enqueue('keybase://convid/target-enrichment', {
    targetUid: 'target-uid',
  })

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'target-uid',
  })
})

test('does not assign an unrelated pending target to the initial URL', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/pending', {
    targetUid: 'target-uid',
  })

  dispatch.markInitialURLHandled('keybase://convid/initial')
  dispatch.enqueue('keybase://convid/initial', {
    targetUid: 'target-uid',
  })

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'target-uid',
    url: 'keybase://convid/initial',
  })
})

test('preserves a pending intent across the account store reset', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/reset-test', {
    targetUid: 'target-uid',
  })
  dispatch.setNavigationReady(true)

  resetAllStores()

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'target-uid',
    url: 'keybase://convid/reset-test',
  })
  expect(useNavigationIntentsState.getState().navigationReady).toBe(false)
})

test('discards an unscoped intent across the account store reset', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://incoming-share')
  dispatch.setNavigationReady(true)

  resetAllStores()

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  expect(useNavigationIntentsState.getState().navigationReady).toBe(false)
})

test('clears duplicate history across the account store reset', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/new-session')
  dispatch.acknowledge(useNavigationIntentsState.getState().intent!.id)

  resetAllStores()
  dispatch.enqueue('keybase://convid/new-session')

  expect(useNavigationIntentsState.getState().intent?.url).toBe(
    'keybase://convid/new-session'
  )
})
