/// <reference types="jest" />
import {addTicker, removeTicker} from './second-timer'

describe('second timer', () => {
  const added: Array<number> = []

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    added.splice(0).forEach(id => removeTicker(id))
    jest.useRealTimers()
  })

  const add = (fn: () => void) => {
    const id = addTicker(fn)
    added.push(id)
    return id
  }

  test('a listener removing itself mid-tick does not skip the next listener', () => {
    const second = jest.fn()
    let ownId = 0
    const first = jest.fn(() => {
      removeTicker(ownId)
    })
    ownId = add(first)
    add(second)

    jest.advanceTimersByTime(1000)

    // the self-removal must not shift the next listener out from under the loop
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('calls the listener once per second', () => {
    const fn = jest.fn()
    add(fn)

    jest.advanceTimersByTime(999)
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(4)
  })

  test('shares one interval across listeners so they tick together', () => {
    const first = jest.fn()
    const second = jest.fn()
    add(first)
    add(second)

    // only one interval was ever created, so both fire on the same tick
    expect(jest.getTimerCount()).toBe(1)
    jest.advanceTimersByTime(1000)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('hands out unique ids', () => {
    expect(add(() => {})).not.toBe(add(() => {}))
  })

  test('a removed listener stops ticking while the others keep going', () => {
    const stays = jest.fn()
    const goes = jest.fn()
    add(stays)
    const goesID = add(goes)

    jest.advanceTimersByTime(1000)
    expect(removeTicker(goesID)).toBe(true)
    jest.advanceTimersByTime(2000)

    expect(goes).toHaveBeenCalledTimes(1)
    expect(stays).toHaveBeenCalledTimes(3)
  })

  test('removing an unknown id is a no-op', () => {
    expect(removeTicker(-1)).toBe(false)
    const id = add(() => {})
    expect(removeTicker(id)).toBe(true)
    expect(removeTicker(id)).toBe(false)
  })

  test('clears the interval once the last listener leaves and restarts on the next one', () => {
    const fn = jest.fn()
    const id = addTicker(fn)
    expect(jest.getTimerCount()).toBe(1)

    removeTicker(id)
    expect(jest.getTimerCount()).toBe(0)
    jest.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()

    add(fn)
    expect(jest.getTimerCount()).toBe(1)
    jest.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
