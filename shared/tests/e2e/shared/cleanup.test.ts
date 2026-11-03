import {settleRelaunch} from '../ios-appium/gate/hang-lib'
import {setBeforeCleanupSteps, withCleanup} from './cleanup'

afterEach(() => {
  setBeforeCleanupSteps(async () => {})
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
