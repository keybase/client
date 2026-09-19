/// <reference types="jest" />
import * as T from '@/constants/types'
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
  jest.restoreAllMocks()
})

// The module remembers a push tap id for the life of the file, the same as the service does for
// the process, so ids must not repeat across tests any more than they do across taps.
let nextPushTapID = 1000
const pushTapID = () => ++nextPushTapID

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
  dispatch.setNavigationReady(true, 'target-uid')

  resetAllStores()

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'target-uid',
    url: 'keybase://convid/reset-test',
  })
  expect(useNavigationIntentsState.getState().navigationReady).toBe(false)
  expect(useNavigationIntentsState.getState().navigationReadyForUid).toBeUndefined()
})

test('discards an unscoped intent across the account store reset', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://incoming-share')
  dispatch.setNavigationReady(true, 'current-uid')

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

// A tap route is not the same thing as its intent: the intent can be enqueued and even acked
// locally while the service still thinks the route is armed, so acking it is a distinct, explicit
// step -- never implied by enqueuing.
test('enqueuing a tap does not ack its route', () => {
  const ack = jest.spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise').mockResolvedValue(undefined)
  const dispatch = useNavigationIntentsState.getState().dispatch
  const id = pushTapID()

  dispatch.enqueue('keybase://convid/tap-target', {pushTapID: id})

  expect(ack).not.toHaveBeenCalled()
})

test('acknowledging a tapped intent acks its route', () => {
  const ack = jest.spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise').mockResolvedValue(undefined)
  const dispatch = useNavigationIntentsState.getState().dispatch
  const id = pushTapID()
  dispatch.enqueue('keybase://convid/tap-target', {pushTapID: id})

  dispatch.acknowledge(useNavigationIntentsState.getState().intent!.id)

  expect(ack).toHaveBeenCalledWith({id})
})

test('acknowledging a plain deep link never calls the tap ack', () => {
  const ack = jest.spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise').mockResolvedValue(undefined)
  const dispatch = useNavigationIntentsState.getState().dispatch
  dispatch.enqueue('keybase://convid/no-tap')

  dispatch.acknowledge(useNavigationIntentsState.getState().intent!.id)

  expect(ack).not.toHaveBeenCalled()
})

test('markInitialURLHandled acks the tapped route it clears', () => {
  const ack = jest.spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise').mockResolvedValue(undefined)
  const dispatch = useNavigationIntentsState.getState().dispatch
  const id = pushTapID()
  dispatch.enqueue('keybase://convid/cold-start-tap', {pushTapID: id})

  dispatch.markInitialURLHandled('keybase://convid/cold-start-tap')

  expect(ack).toHaveBeenCalledWith({id})
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

// The route stays armed on a lost peek reply, so drainPushTapRoute's next peek re-delivers the
// same id. Re-enqueuing it must not queue (and so navigate) a second time.
test('re-enqueuing a still-pending tap id does not replace or duplicate the intent', () => {
  const dispatch = useNavigationIntentsState.getState().dispatch
  const id = pushTapID()
  dispatch.enqueue('keybase://convid/tap-target', {pushTapID: id})
  const first = useNavigationIntentsState.getState().intent

  dispatch.enqueue('keybase://convid/tap-target', {pushTapID: id})

  expect(useNavigationIntentsState.getState().intent).toBe(first)
})

// A redelivery after the route has already been consumed -- the ack RPC itself failed, so the
// service never retired it -- must not navigate a second time, however long ago that was.
test('re-enqueuing an already-consumed tap id after its duplicate window has passed queues nothing', () => {
  jest.spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise').mockRejectedValue(new Error('disconnected'))
  const dispatch = useNavigationIntentsState.getState().dispatch
  const id = pushTapID()
  dispatch.enqueue('keybase://convid/tap-target', {pushTapID: id})
  dispatch.acknowledge(useNavigationIntentsState.getState().intent!.id)

  const realNow = Date.now()
  jest.spyOn(Date, 'now').mockReturnValue(realNow + 60_000)
  dispatch.enqueue('keybase://convid/tap-target', {pushTapID: id})

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})
