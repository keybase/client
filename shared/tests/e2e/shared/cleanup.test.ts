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

test('a step the body was running when taken is waited for, and not run again once it passed', async () => {
  let take: TakeSteps = () => []
  setCleanupStepKeeper(t => {
    take = t
    return () => {}
  })
  const ran: Array<string> = []
  let release = () => {}
  const stuck = new Promise<void>(resolve => (release = resolve))
  const slow = async () => {
    ran.push('slow started')
    await stuck
    ran.push('slow done')
  }
  const b = () => ran.push('b')
  const run = withCleanup(async () => {}, [slow, b])
  for (let i = 0; i < 5; i++) await Promise.resolve()
  const taken = take()
  expect(taken).toHaveLength(2)
  expect(taken[1]).toBe(b)
  const gate = (async () => {
    for (const s of taken) await s()
  })()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  // the gate waits for the body's run of it, never starting its own beside it
  expect(ran).toEqual(['slow started'])
  release()
  await run
  await gate
  // the body ran no step after it
  expect(ran).toEqual(['slow started', 'slow done', 'b'])
})

test('a step the body was running when taken runs again once the body\'s run of it threw', async () => {
  let take: TakeSteps = () => []
  setCleanupStepKeeper(t => {
    take = t
    return () => {}
  })
  const ran: Array<string> = []
  let release = () => {}
  const stuck = new Promise<void>(resolve => (release = resolve))
  let calls = 0
  const restore = async () => {
    calls++
    ran.push(`restore ${calls}`)
    if (calls === 1) {
      await stuck
      throw new Error('attempt over: t')
    }
  }
  const run = withCleanup(async () => {}, [restore])
  for (let i = 0; i < 5; i++) await Promise.resolve()
  const taken = take()
  const gate = (async () => {
    for (const s of taken) await s()
  })()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  expect(ran).toEqual(['restore 1'])
  release()
  await expect(run).rejects.toThrow('attempt over: t')
  await gate
  expect(ran).toEqual(['restore 1', 'restore 2'])
})
