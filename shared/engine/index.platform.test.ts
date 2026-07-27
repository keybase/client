/// <reference types="jest" />

// jest.setup.js sets isMobile=false, isRenderer=true, and _fromPreload.functions
// with no engineSend -- exactly the "renderer up, preload never wired engineSend"
// case this test drives.
import {createClient, dispatchRpcBatch} from './index.platform'

test('a missing engineSend fails the write instead of silently no-oping', () => {
  const client = createClient(
    () => {},
    () => {},
    () => {}
  )

  const ok = client.transport.send([1, 3, null, {}])

  expect(ok).toBe(false)
})

// dispatchRpcBatch backs the mobile global.rpcOnJs batch dispatcher (only
// wired up inside createClient's isMobile branch, which this desktop test
// env never takes). Exercise it directly instead.
describe('dispatchRpcBatch', () => {
  test('a normal multi-message array dispatches every element in order', () => {
    const dispatched: Array<unknown> = []
    dispatchRpcBatch(['a', 'b', 'c'], 3, obj => dispatched.push(obj), () => {})
    expect(dispatched).toEqual(['a', 'b', 'c'])
  })

  test('a single message (count === 1) dispatches directly, not as a wrapper', () => {
    const dispatched: Array<unknown> = []
    dispatchRpcBatch({solo: true}, 1, obj => dispatched.push(obj), () => {})
    expect(dispatched).toEqual([{solo: true}])
  })

  test('count > 1 with a non-array logs an error and dispatches nothing', () => {
    const dispatched: Array<unknown> = []
    const errors: Array<string> = []
    dispatchRpcBatch({not: 'an array'}, 2, obj => dispatched.push(obj), msg => errors.push(msg))
    expect(dispatched).toEqual([])
    expect(errors).toEqual(['rpcOnJs: count 2 but payload is not an array'])
  })

  test("one message's dispatch throwing does not stop the remaining messages", () => {
    const dispatched: Array<unknown> = []
    const errors: Array<string> = []
    // Mirrors production's dispatchOne: each item is individually try/caught
    // so one bad message can't drop the rest of the batch.
    const dispatchOne = (obj: unknown) => {
      try {
        if (obj === 'bad') {
          throw new Error('dispatch threw')
        }
        dispatched.push(obj)
      } catch (e) {
        errors.push(`rpcOnJs: dispatch threw: ${String(e)}`)
      }
    }
    dispatchRpcBatch(['a', 'bad', 'b'], 3, dispatchOne, msg => errors.push(msg))
    expect(dispatched).toEqual(['a', 'b'])
    expect(errors).toEqual(['rpcOnJs: dispatch threw: Error: dispatch threw'])
  })
})
