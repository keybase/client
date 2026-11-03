import {attemptOverMessage, createBinding, isAttemptOver, refusal} from './attempt-binding-lib'

const tick = async () => new Promise<void>(resolve => setImmediate(resolve))

test('outside any attempt nothing is refused', () => {
  const b = createBinding<string>()
  expect(refusal(b.frame())).toBeUndefined()
  expect(() => b.requireCurrent()).not.toThrow()
  expect(b.endRunningBodies()).toEqual([])
})

test('a running body is current until mocha moves on from it, then every check in it throws', async () => {
  const b = createBinding<string>()
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const body = b.runBody('a1', 'flow t', async () => {
    expect(() => b.requireCurrent()).not.toThrow()
    expect(b.frame()?.value).toBe('a1')
    await gate
    b.requireCurrent()
  })
  await tick()
  // a hook begins while the body still runs: mocha timed it out
  expect(b.endRunningBodies()).toEqual(['flow t'])
  release()
  await expect(body).rejects.toThrow('attempt over: flow t')
  // marked once: a later hook finds no running body
  expect(b.endRunningBodies()).toEqual([])
})

test('work a finished body left running is refused, whether the body passed or threw', async () => {
  const b = createBinding<string>()
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const leftovers: Array<Promise<void>> = []
  const leave = (n: number) => {
    leftovers.push(
      (async () => {
        b.requireCurrent()
        await gate
        b.requireCurrent()
      })().then(() => {
        throw new Error(`leftover ${n} ran`)
      })
    )
  }
  await b.runBody('a1', 'passed', async () => {
    await tick()
    leave(1)
  })
  await expect(
    b.runBody('a2', 'threw', async () => {
      await tick()
      leave(2)
      throw new Error('boom')
    })
  ).rejects.toThrow('boom')
  // settled bodies are not running: a hook marks nothing
  expect(b.endRunningBodies()).toEqual([])
  release()
  const settled = await Promise.allSettled(leftovers)
  expect(settled.map(r => (r.status === 'rejected' && r.reason instanceof Error ? r.reason.message : r.status))).toEqual([
    'attempt over: passed',
    'attempt over: threw',
  ])
})

test('a hook is never refused, even in the context of a body that is over', async () => {
  const b = createBinding<string>()
  let hookRan: Promise<{bound?: string; refused?: string}> = Promise.resolve({})
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const body = b.runBody('a1', 'timed out', async () => {
    // a this.timeout() in a body starts mocha's timer in the body's context, so its callback, and the
    // hooks mocha runs from it, inherit that context
    hookRan = new Promise(resolve =>
      setTimeout(() => {
        b.endRunningBodies()
        const bound = b.run(undefined, () => b.frame()?.value)
        const refused = b.run(undefined, () => refusal(b.frame()))
        // the root afterEach ends the attempt bound to it, outside the body
        b.run('a1', () => b.requireCurrent())
        resolve({bound, refused})
      }, 0)
    )
    await gate
    b.requireCurrent()
  })
  expect(await hookRan).toEqual({bound: undefined, refused: undefined})
  release()
  await expect(body).rejects.toThrow('attempt over: timed out')
})

test('nested async work a body started is refused with the body, wherever it runs', async () => {
  const b = createBinding<string>()
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const seen: Array<string> = []
  const check = (what: string) => {
    try {
      b.requireCurrent()
      seen.push(`${what}: ran`)
    } catch (e) {
      seen.push(`${what}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  let nested: Promise<unknown> = Promise.resolve()
  const body = b.runBody('a1', 'loop', async () => {
    const inner = async (n: number) => {
      check(`before ${n}`)
      await gate
      check(`after ${n}`)
    }
    // a fire-and-forget chain, a timer and parallel work, each started inside the body
    nested = Promise.all([inner(1), inner(2), new Promise<void>(resolve =>
        setTimeout(() => {
          check('timer')
          resolve()
        }, 5)
      )])
    await nested
  })
  await tick()
  b.endRunningBodies()
  release()
  await nested
  await body
  expect(seen).toEqual([
    'before 1: ran',
    'before 2: ran',
    'after 1: attempt over: loop',
    'after 2: attempt over: loop',
    'timer: attempt over: loop',
  ])
})

test('a timed-out body never touches the body of its retry', async () => {
  const b = createBinding<string>()
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const first = b.runBody('r0', 'flaky', async () => {
    await gate
    b.requireCurrent()
  })
  await tick()
  b.endRunningBodies()
  await b.runBody('r1', 'flaky', async () => {
    release()
    await expect(first).rejects.toThrow('attempt over: flaky')
    expect(() => b.requireCurrent()).not.toThrow()
    expect(b.frame()?.value).toBe('r1')
  })
})

test('an attempt-over error is told apart by its message', () => {
  expect(attemptOverMessage('d t')).toBe('attempt over: d t')
  expect(isAttemptOver(new Error(attemptOverMessage('x')))).toBe(true)
  expect(isAttemptOver(new Error('timed out after 5ms waiting for x'))).toBe(false)
  expect(isAttemptOver('attempt over: x')).toBe(false)
})

test('a timer started bound to no body keeps passing the check once the body that started it is over', async () => {
  const b = createBinding<string>()
  const results: Array<string> = []
  let timer: ReturnType<typeof setInterval> | undefined
  let bound: ReturnType<typeof setInterval> | undefined
  const check = (out: string) => () => {
    try {
      b.requireCurrent()
      results.push(`${out} ok`)
    } catch (e) {
      results.push(`${out} ${isAttemptOver(e) ? 'over' : 'other'}`)
    }
  }
  await b.runBody('a1', 'flow t', async () => {
    timer = b.run(undefined, () => setInterval(check('unbound'), 5))
    bound = setInterval(check('bound'), 5)
    await tick()
  })
  await new Promise(resolve => setTimeout(resolve, 30))
  clearInterval(timer)
  clearInterval(bound)
  expect(results.filter(r => r.startsWith('unbound')).every(r => r === 'unbound ok')).toBe(true)
  expect(results).toContain('bound over')
})

test('the owner is told of a body ended while it ran, not of one that settled', async () => {
  const ended: Array<string> = []
  const b = createBinding<string>(v => ended.push(v))
  await b.runBody('settled', 'flow s', async () => {})
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const timedOut = b.runBody('timed out', 'flow t', async () => gate)
  const wdio = b.runBody('wdio', 'flow w', async () => {
    b.endCurrentBody()
    // ended once: a second end and the hook's sweep tell the owner nothing more
    b.endCurrentBody()
    await gate
  })
  await tick()
  expect(b.endRunningBodies()).toEqual(['flow t'])
  release()
  await timedOut
  await wdio
  expect(ended).toEqual(['wdio', 'timed out'])
})

test('a body whose test function settled is ended without handing anything over', async () => {
  const ended: Array<string> = []
  const b = createBinding<string>(v => ended.push(v))
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const settled = b.runBody('a1', 'settled', async () => {
    b.settleCurrentBody()
    await gate
  })
  const cut = b.runBody('a2', 'cut', async () => {
    await gate
  })
  await tick()
  expect(b.endRunningBodies()).toEqual(['cut'])
  expect(ended).toEqual(['a2'])
  release()
  await settled
  await cut
  await b.runBody('a3', 'wdio', async () => {
    await tick()
    b.settleCurrentBody()
    b.endCurrentBody()
    expect(() => b.requireCurrent()).toThrow('attempt over: wdio')
  })
  expect(ended).toEqual(['a2'])
})

test('guarded hook work runs until its guard ends, then every check in it throws', async () => {
  const b = createBinding<string>()
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const {done, end} = b.runGuarded('a1', 'left cleanup', async () => {
    b.requireCurrent()
    expect(b.frame()?.value).toBe('a1')
    await gate
    b.requireCurrent()
  })
  await tick()
  end()
  release()
  await expect(done).rejects.toThrow('attempt over: left cleanup')
})
