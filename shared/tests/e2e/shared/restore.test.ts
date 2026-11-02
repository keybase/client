import {thenRestoring} from './restore'

const fail = (m: string) => async () => Promise.reject(new Error(m))

test('the restore runs after a pass, and its failure is the error', async () => {
  const order: Array<string> = []
  const f = async () => {
    order.push('f')
    return Promise.resolve(1)
  }
  const restore = async () => {
    order.push('restore')
    return Promise.resolve()
  }
  await expect(thenRestoring(f, restore, 'x')).resolves.toBe(1)
  expect(order).toEqual(['f', 'restore'])
  await expect(thenRestoring(async () => Promise.resolve(1), fail('restore broke'), 'x')).rejects.toThrow('restore broke')
})

test('the restore runs after a failure, which stays the error', async () => {
  let restored = false
  const restore = async () => {
    restored = true
    return Promise.resolve()
  }
  await expect(thenRestoring(fail('f broke'), restore, 'x')).rejects.toThrow(/^f broke$/)
  expect(restored).toBe(true)
})

test('a failed restore after a failure keeps both errors', async () => {
  const got = await thenRestoring(fail('f broke'), fail('restore broke'), 'switching back').catch((e: unknown) => e)
  expect(got).toBeInstanceOf(AggregateError)
  const agg = got as AggregateError
  expect(agg.message).toBe('Error: f broke; and then switching back failed: Error: restore broke')
  expect(agg.errors.map((e: Error) => e.message)).toEqual(['f broke', 'restore broke'])
})
