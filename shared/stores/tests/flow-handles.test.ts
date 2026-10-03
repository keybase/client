/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'

import {callNamed, setNamedScoped} from '../flow-handles'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('scoped named disposers do not clear newer replacement handlers', () => {
  const stale = jest.fn()
  const current = jest.fn()

  const staleHandle = setNamedScoped('recoverPassword', 'submitPassword', stale)
  const currentHandle = setNamedScoped('recoverPassword', 'submitPassword', current)

  staleHandle.dispose()
  callNamed('recoverPassword', 'submitPassword', 'hunter2')
  expect(stale).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledWith('hunter2')

  currentHandle.dispose()
  callNamed('recoverPassword', 'submitPassword', 'again')
  expect(current).toHaveBeenCalledTimes(1)
})

test("an older flow's disposer running after a reset leaves a newer flow's handler", () => {
  const current = jest.fn()
  const staleHandle = setNamedScoped('recoverPassword', 'submitPassword', jest.fn())
  resetAllStores()
  setNamedScoped('recoverPassword', 'submitPassword', current)

  staleHandle.dispose()
  callNamed('recoverPassword', 'submitPassword', 'hunter2')
  expect(current).toHaveBeenCalledWith('hunter2')
})
