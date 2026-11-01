import {settleRelaunch} from '../ios-appium/gate/hang-lib'
import {setBeforeCleanupSteps, setCleanupStepKeeper, withCleanup, type TakeSteps} from './cleanup'

afterEach(() => {
  setBeforeCleanupSteps(async () => {})
  setCleanupStepKeeper(() => () => {})
})

test("a flow's cleanup steps wait for a hung app's relaunch still running", async () => {
  let finish: () => void = () => {}
  const relaunch = new Promise<void>(resolve => {
    finish = resolve
  })
  // as the iOS gate sets it: wait for the relaunch in flight
  setBeforeCleanupSteps(async () => settleRelaunch(relaunch, 5_000))
  const order: Array<string> = []
  const run = withCleanup(
    async () => {
      order.push('body')
      await Promise.reject(new Error('the stuck command failed when the app was killed'))
    },
    [() => order.push('cleanup')]
  )
  for (let i = 0; i < 5; i++) await Promise.resolve()
  expect(order).toEqual(['body'])
  order.push('relaunched')
  finish()
  await expect(run).rejects.toThrow('the stuck command failed when the app was killed')
  expect(order).toEqual(['body', 'relaunched', 'cleanup'])
})

test('with nothing set, cleanup runs right after the body', async () => {
  const order: Array<string> = []
  await withCleanup(
    async () => {
      order.push('body')
      await Promise.resolve()
    },
    [() => order.push('cleanup')]
  )
  expect(order).toEqual(['body', 'cleanup'])
})

test('steps a gate took over are left to it, and the keeper is released when withCleanup is done', async () => {
  let take: TakeSteps = () => []
  let released = 0
  setCleanupStepKeeper(t => {
    take = t
    return () => released++
  })
  const ran: Array<string> = []
  const a = () => ran.push('a')
  const b = () => ran.push('b')
  await withCleanup(async () => {
    // the gate ends the body before its cleanup
    expect(take()).toEqual([a, b])
    await Promise.reject(new Error('attempt over: t'))
  }, [a, b]).catch(() => {})
  expect(ran).toEqual([])
  expect(released).toBe(1)
})

test('with no keeper set, withCleanup runs every step itself (the desktop gate)', async () => {
  const ran: Array<string> = []
  await expect(
    withCleanup(async () => Promise.reject(new Error('body')), [() => ran.push('a'), () => ran.push('b')])
  ).rejects.toThrow('body')
  expect(ran).toEqual(['a', 'b'])
})
