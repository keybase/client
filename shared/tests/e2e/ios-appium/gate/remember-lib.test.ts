import {repairRememberLeftOff, type RememberSides} from './remember-lib'

const fake = (start: {remember: boolean; stored: boolean}, opts: {setTakes?: boolean} = {}) => {
  const calls: Array<string> = []
  const state = {...start}
  const sides: RememberSides = {
    remember: async () => {
      calls.push('remember')
      return Promise.resolve(state.remember)
    },
    setRememberOn: async () => {
      calls.push('set')
      if (opts.setTakes !== false) state.remember = true
      return Promise.resolve()
    },
    signInWithPassword: async () => {
      calls.push('signIn')
      state.stored = true
      return Promise.resolve()
    },
    storedSecret: async () => {
      calls.push('stored')
      return Promise.resolve(state.stored)
    },
    toSecond: async () => {
      calls.push('toSecond')
      return Promise.resolve()
    },
  }
  return {calls, sides}
}

test('a setting already on is read on the second account and left alone', async () => {
  const {calls, sides} = fake({remember: true, stored: true})
  expect(await repairRememberLeftOff(sides)).toBe(false)
  expect(calls).toEqual(['stored', 'toSecond', 'remember'])
})

test('a setting left off is put back on from the second account and read back', async () => {
  const {calls, sides} = fake({remember: false, stored: true})
  expect(await repairRememberLeftOff(sides)).toBe(true)
  expect(calls).toEqual(['stored', 'toSecond', 'remember', 'set', 'remember', 'stored'])
})

test('a missing stored secret is signed in with the password before anything is read', async () => {
  const {calls, sides} = fake({remember: false, stored: false})
  expect(await repairRememberLeftOff(sides)).toBe(true)
  expect(calls.slice(0, 3)).toEqual(['stored', 'signIn', 'toSecond'])
  expect(calls).toContain('set')
})

test('a set that does not take throws', async () => {
  const {sides} = fake({remember: false, stored: true}, {setTakes: false})
  await expect(repairRememberLeftOff(sides)).rejects.toThrow('did not go back on')
})
