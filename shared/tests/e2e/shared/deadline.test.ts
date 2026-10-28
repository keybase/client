import {runAbortable, withDeadline} from './deadline'

describe('withDeadline', () => {
  test('passes the answer through', async () => {
    await expect(withDeadline(Promise.resolve(3), 1_000, 'three')).resolves.toBe(3)
  })

  test('rejects naming what it waited for', async () => {
    await expect(withDeadline(new Promise(() => {}), 10, 'the renderer')).rejects.toThrow('the renderer: no answer in 0.01s')
  })
})

describe('runAbortable', () => {
  test('done in time: its value, never aborted', async () => {
    let signal: AbortSignal | undefined
    const r = await runAbortable('the sweep', 1_000, 1_000, async s => {
      signal = s
      return Promise.resolve('swept')
    })
    expect(r).toEqual({ok: true, value: 'swept'})
    expect(signal?.aborted).toBe(false)
  })

  test('a failure in time is passed through', async () => {
    await expect(runAbortable('the sweep', 1_000, 1_000, async () => Promise.reject(new Error('listing failed')))).rejects.toThrow('listing failed')
  })

  test('at the deadline it aborts, then waits for the work to settle before returning', async () => {
    const events: Array<string> = []
    const r = await runAbortable('the sweep', 20, 1_000, async signal =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          setTimeout(() => {
            events.push('work stopped')
            reject(new Error('stopped'))
          }, 30)
        )
      })
    )
    events.push('returned')
    expect(events).toEqual(['work stopped', 'returned'])
    expect(r).toEqual({message: 'the sweep: not done in 0.02s; stopped it', ok: false, settled: true})
  })

  test('work that ignores the abort is reported as still running once the settle wait is over', async () => {
    const r = await runAbortable('the sweep', 10, 20, async () => new Promise(() => {}))
    expect(r).toEqual({message: 'the sweep: not done in 0.01s, and still running 0.02s after it was told to stop', ok: false, settled: false})
  })
})
