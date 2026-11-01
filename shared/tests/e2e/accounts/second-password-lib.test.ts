/* eslint-disable @typescript-eslint/require-await -- fakes stand in for async deps */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {readEnvFile, type E2EEnv} from './env'
import {
  BACK_TO_SMOKE_WORST_MS,
  CHECK_OR_REPAIR_WORST_MS,
  CHECK_WORST_MS,
  REPAIR_WORST_MS,
  checkOrRepairSecondSecret,
  checkSecondSecretSurvives,
  KEYCHAIN_NOTE,
  newPassword,
  repairSecondSecret,
  rotateSecondPassword,
  secondPasswordIsCurrent,
  setSecondPasswordViaPeer,
  settlePendingSecondPassword,
  thenRestore,
  type MainSide,
  type RpcLike,
} from './second-password-lib'

const env: E2EEnv = {
  peers: {
    owner: {home: '/x/owner', paperKey: 'p', user: 'testuser'},
    second: {home: '/x/second', paperKey: 'p', user: 'testuser-mac'},
  },
  secondUser: 'testuser-mac',
  smokeUser: 'testuser',
  team: 'testteam',
}

// The main service as the CLI stub sees it: who it is signed in as, and every switch asked for.
const fakeMain = (opts: {secondPrompts?: boolean; switchFails?: boolean} = {}) => {
  let who = 'testuser'
  const calls: string[] = []
  const side: MainSide = {
    say: () => {},
    switchMain: async user => {
      calls.push(`switch ${user}`)
      // a stored secret that is gone makes `login --switch` prompt; the app cancels the prompt
      if (user === 'testuser-mac' && opts.secondPrompts) throw new Error('keybase login --switch testuser-mac: Input canceled')
      if (user === 'testuser-mac' && opts.switchFails) throw new Error('keybase login --switch testuser-mac: boom')
      who = user
    },
    whoami: async () => who,
  }
  return {calls, side, who: () => who}
}

describe('newPassword', () => {
  test('is e2e- and 24 base36 characters, new each time', () => {
    const a = newPassword()
    expect(a).toMatch(/^e2e-[0-9a-z]{24}$/)
    expect(newPassword()).not.toBe(a)
  })
})

describe('rotateSecondPassword', () => {
  let dir = ''
  let file = ''
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-pw-'))
    fs.chmodSync(dir, 0o700)
    file = path.join(dir, 'env')
    fs.writeFileSync(file, "export KB_SECOND_PASSWORD='old-pw'\n", {mode: 0o600})
  })
  afterEach(() => fs.rmSync(dir, {force: true, recursive: true}))
  const read = () => fs.readFileSync(file, 'utf8')

  test('rotateSecondPassword writes _NEXT before the change and promotes after the check', async () => {
    const seen: string[] = []
    const next = await rotateSecondPassword(
      env,
      async pw => {
        seen.push(`change: ${read().includes(`KB_SECOND_PASSWORD_NEXT='${pw}'`)}`)
      },
      {
        check: async () => {
          seen.push(`check: still old ${read().includes("KB_SECOND_PASSWORD='old-pw'")}`)
        },
        envFile: file,
        repair: async () => {
          seen.push('repair')
        },
      }
    )
    expect(seen).toEqual(['change: true', 'check: still old true'])
    expect(read()).toBe(`export KB_SECOND_PASSWORD='${next}'\n`)
  })

  test('a failed check runs the repair with the new password and re-checks', async () => {
    const seen: string[] = []
    let checks = 0
    const next = await rotateSecondPassword(env, async () => {}, {
      check: async () => {
        checks++
        seen.push(`check ${checks}`)
        if (checks === 1) throw new Error('prompted')
      },
      envFile: file,
      repair: async (_e, pw) => {
        seen.push(`repair ${pw === readNext() ? 'with next' : 'with something else'}`)
      },
    })
    expect(seen).toEqual(['check 1', 'repair with next', 'check 2'])
    expect(read()).toBe(`export KB_SECOND_PASSWORD='${next}'\n`)
  })
  const readNext = () => /KB_SECOND_PASSWORD_NEXT='([^']*)'/.exec(read())?.[1]

  test('a failed repair leaves _NEXT in the file and KB_SECOND_PASSWORD untouched, and throws', async () => {
    let next = ''
    await expect(
      rotateSecondPassword(
        env,
        async pw => {
          next = pw
        },
        {
          check: async () => {
            throw new Error('prompted')
          },
          envFile: file,
          repair: async () => {
            throw new Error('login failed')
          },
        }
      )
    ).rejects.toThrow(
      "the second account's stored secret on the main service is broken after a password change; the current password is KB_SECOND_PASSWORD_NEXT in the env file"
    )
    expect(read()).toBe(`export KB_SECOND_PASSWORD='old-pw'\nexport KB_SECOND_PASSWORD_NEXT='${next}'\n`)
  })

  test('no thrown message contains the password', async () => {
    const leaky = async (_e: E2EEnv, pw?: string) => {
      throw new Error(`echoed ${pw ?? readNext() ?? ''}`)
    }
    let next = ''
    const err = await rotateSecondPassword(
      env,
      async pw => {
        next = pw
      },
      {check: leaky, envFile: file, repair: leaky}
    ).catch((e: unknown) => e as Error)
    expect(next).not.toBe('')
    expect(String(err)).not.toContain(next)
    expect(String((err as Error).cause instanceof Error ? (err as Error).cause : '')).not.toContain(next)
    // a change that fails says so without the password, and leaves _NEXT for a change that took anyway
    fs.writeFileSync(file, "export KB_SECOND_PASSWORD='old-pw'\n", {mode: 0o600})
    const err2 = await rotateSecondPassword(
      env,
      async pw => {
        next = pw
        throw new Error(`rejected ${pw}`)
      },
      {check: leaky, envFile: file, repair: leaky}
    ).catch((e: unknown) => e as Error)
    expect(String(err2)).toMatch(/KB_SECOND_PASSWORD_NEXT/)
    expect(String(err2)).not.toContain(next)
    expect(readNext()).toBe(next)
  })

  test.each([
    ['in the env file', {}, "export KB_SECOND_PASSWORD='old-pw'\nexport KB_SECOND_PASSWORD_NEXT='pending-pw'\n"],
    ['in the loaded env', {secondPasswordChangePending: true}, "export KB_SECOND_PASSWORD='old-pw'\n"],
  ])('refuses, changing nothing, while a KB_SECOND_PASSWORD_NEXT is pending %s', async (_where, extra, text) => {
    fs.writeFileSync(file, text, {mode: 0o600})
    const seen: string[] = []
    const record = (what: string) => async () => {
      seen.push(what)
    }
    await expect(
      rotateSecondPassword({...env, ...extra}, record('change'), {check: record('check'), envFile: file, repair: record('repair')})
    ).rejects.toThrow(/KB_SECOND_PASSWORD_NEXT: a password change stopped part way/)
    expect(seen).toEqual([])
    expect(read()).toBe(text)
  })
})

describe('checkSecondSecretSurvives', () => {
  test('passes when the switch to second needs no prompt, and ends on smoke', async () => {
    const main = fakeMain()
    const trips: string[] = []
    await checkSecondSecretSurvives(env, {
      ...main.side,
      roundTrip: async () => {
        trips.push(`roundtrip as ${main.who()}`)
      },
    })
    expect(main.calls).toEqual(['switch testuser-mac', 'switch testuser'])
    expect(trips).toEqual(['roundtrip as testuser'])
    expect(main.who()).toBe('testuser')
  })

  test('fails when the stored secret is gone (login --switch asks for a password)', async () => {
    const main = fakeMain({secondPrompts: true})
    await expect(checkSecondSecretSurvives(env, {...main.side, roundTrip: async () => {}})).rejects.toThrow(/Input canceled/)
    expect(main.who()).toBe('testuser')
  })

  test('the switch back to smoke runs when the switch to second fails', async () => {
    const main = fakeMain({switchFails: true})
    let tripped = false
    await expect(
      checkSecondSecretSurvives(env, {
        ...main.side,
        // the switch failed half way: the service is signed out
        switchMain: async user => {
          await main.side.switchMain(user).catch(async (e: unknown) => {
            await main.side.switchMain('')
            throw e
          })
        },
        roundTrip: async () => {
          tripped = true
        },
      })
    ).rejects.toThrow(/boom/)
    expect(main.calls.at(-1)).toBe('switch testuser')
    expect(main.who()).toBe('testuser')
    expect(tripped).toBe(false)
  })

  test('after a switch that gives no answer, one switch back, then the owner action naming the Keychain', async () => {
    const calls: string[] = []
    const err = await checkSecondSecretSurvives(env, {
      roundTrip: async () => {},
      say: () => {},
      switchMain: async user => {
        calls.push(`switch ${user}`)
        throw new Error(`keybase login --switch ${user}: no answer in 60s`)
      },
      whoami: async () => '',
    }).then(() => new Error('it passed'), (e: unknown) => e as Error)
    expect(calls).toEqual(['switch testuser-mac', 'switch testuser'])
    expect(err.message).toMatch(/after 1 attempts/)
    expect(err.message).toContain(KEYCHAIN_NOTE)
  })

  test('a switch that fails with an answer keeps the three switches back', async () => {
    const calls: string[] = []
    const err = await checkSecondSecretSurvives(env, {
      roundTrip: async () => {},
      say: () => {},
      switchMain: async user => {
        calls.push(`switch ${user}`)
        throw new Error('Input canceled')
      },
      whoami: async () => '',
    }).then(() => new Error('it passed'), (e: unknown) => e as Error)
    expect(calls.filter(c => c === 'switch testuser')).toHaveLength(3)
    expect(err.message).not.toContain(KEYCHAIN_NOTE)
  })

  test('fails when the peer round trip fails', async () => {
    const main = fakeMain()
    await expect(
      checkSecondSecretSurvives(env, {
        ...main.side,
        roundTrip: async () => {
          throw new Error('the main service did not read e2e-x-pwcheck within 20s')
        },
      })
    ).rejects.toThrow(/did not read/)
  })
})

describe('repairSecondSecret', () => {
  test('signs second in with the password and ends on smoke', async () => {
    const main = fakeMain()
    const seen: string[] = []
    await repairSecondSecret(env, 'e2e-newpassword', {
      ...main.side,
      signIn: async (_e, pw) => {
        seen.push(`sign in ${pw}`)
        // the app signs second in, then leaves the service on whoever it switched back to
        await main.side.switchMain('testuser-mac')
      },
    })
    expect(seen).toEqual(['sign in e2e-newpassword'])
    expect(main.who()).toBe('testuser')
  })

  test('switches back to smoke when the sign-in fails, and never puts the password in the error', async () => {
    const main = fakeMain()
    await main.side.switchMain('testuser-mac')
    const err = await repairSecondSecret(env, 'e2e-newpassword', {
      ...main.side,
      signIn: async () => {
        throw new Error('login failed: bad password e2e-newpassword')
      },
    }).catch((e: unknown) => e as Error)
    expect(String(err)).toMatch(/login failed/)
    expect(String(err)).not.toContain('e2e-newpassword')
    expect(main.who()).toBe('testuser')
  })
})

describe('setSecondPasswordViaPeer', () => {
  const peerWith = (hasServerKeys: boolean) => {
    const sent: Array<{method: string; arg: unknown}> = []
    const rpc: RpcLike = {
      call: async <T,>(method: string, arg: object) => {
        sent.push({arg, method})
        return (method === 'keybase.1.account.hasServerKeys' ? {hasServerKeys} : null) as T
      },
      close: () => {},
    }
    return {peerRpc: async () => rpc, sent}
  }

  test('sends passphraseChange with force and no old password', async () => {
    const peer = peerWith(false)
    await setSecondPasswordViaPeer(env, 'e2e-next', peer)
    expect(peer.sent).toEqual([
      {arg: {sessionID: 0}, method: 'keybase.1.account.hasServerKeys'},
      {arg: {force: true, oldPassphrase: '', passphrase: 'e2e-next', sessionID: 0}, method: 'keybase.1.account.passphraseChange'},
    ])
  })

  test('setSecondPasswordViaPeer refuses when hasServerKeys is true and sends nothing', async () => {
    const peer = peerWith(true)
    await expect(setSecondPasswordViaPeer(env, 'e2e-next', peer)).rejects.toThrow(/server-synced PGP key/)
    expect(peer.sent.map(s => s.method)).toEqual(['keybase.1.account.hasServerKeys'])
  })
})

describe('secondPasswordIsCurrent', () => {
  const peerAnswering = (answer: () => unknown) => {
    const sent: Array<{method: string; arg: unknown}> = []
    let closed = false
    const rpc: RpcLike = {
      call: async <T,>(method: string, arg: object) => {
        sent.push({arg, method})
        return answer() as T
      },
      close: () => {
        closed = true
      },
    }
    return {closed: () => closed, peerRpc: async () => rpc, sent}
  }

  test('sends passphraseCheck with the password and reads its answer', async () => {
    const yes = peerAnswering(() => true)
    expect(await secondPasswordIsCurrent(env, 'e2e-pw', yes)).toBe(true)
    expect(yes.sent).toEqual([{arg: {passphrase: 'e2e-pw', sessionID: 0}, method: 'keybase.1.account.passphraseCheck'}])
    expect(yes.closed()).toBe(true)
    expect(await secondPasswordIsCurrent(env, 'e2e-pw', peerAnswering(() => false))).toBe(false)
  })

  test('an error leaves the password out of its message, and an empty password sends nothing', async () => {
    const failing = peerAnswering(() => {
      throw new Error('peer said e2e-pw is odd')
    })
    await expect(secondPasswordIsCurrent(env, 'e2e-pw', failing)).rejects.toThrow(
      new Error('checking the second account password on its peer: peer said <password> is odd')
    )
    expect(failing.closed()).toBe(true)
    const empty = peerAnswering(() => true)
    await expect(secondPasswordIsCurrent(env, '', empty)).rejects.toThrow('no second account password to check')
    expect(empty.sent).toEqual([])
  })
})

describe('checkOrRepairSecondSecret', () => {
  test('a passing check needs no repair', async () => {
    const seen: string[] = []
    await checkOrRepairSecondSecret(env, 'e2e-pw', {
      check: async () => void seen.push('check'),
      repair: async () => void seen.push('repair'),
    })
    expect(seen).toEqual(['check'])
  })

  test('a failed check repairs with the given password and checks again; a second failure throws without the password', async () => {
    const seen: string[] = []
    let checks = 0
    await checkOrRepairSecondSecret(env, 'e2e-pw', {
      check: async () => {
        seen.push('check')
        if (++checks === 1) throw new Error('prompted')
      },
      repair: async (_e, pw) => void seen.push(`repair ${pw}`),
    })
    expect(seen).toEqual(['check', 'repair e2e-pw', 'check'])
    const err = await checkOrRepairSecondSecret(env, 'e2e-pw', {
      check: async () => {
        throw new Error('prompted e2e-pw')
      },
      repair: async () => {},
    }).catch((e: unknown) => e as Error)
    expect(String(err)).toMatch(/stored secret.*broken/)
    expect(String(err)).not.toContain('e2e-pw')
  })
})

describe('checkOrRepairSecondSecret seams', () => {
  test('the check is handed the password it checks', async () => {
    const seen: string[] = []
    await checkOrRepairSecondSecret(env, 'e2e-pw', {check: async (_e, pw) => void seen.push(`check ${pw}`), repair: async () => {}})
    expect(seen).toEqual(['check e2e-pw'])
  })

  test('a failure the deps call unrepairable is thrown at once, without the password, and nothing is repaired', async () => {
    const seen: string[] = []
    const err = await checkOrRepairSecondSecret(env, 'e2e-pw', {
      check: async () => {
        seen.push('check')
        throw new Error('the host is broken e2e-pw')
      },
      repair: async () => void seen.push('repair'),
      repairable: () => false,
    }).catch((e: unknown) => e as Error)
    expect(seen).toEqual(['check'])
    expect(String(err)).toContain('the host is broken')
    expect(String(err)).not.toContain('e2e-pw')
  })
})

describe('thenRestore', () => {
  test('a failed restore after a failed step keeps both errors, the step first, without the secret', async () => {
    const err = await thenRestore(
      async () => {
        throw new Error('step failed with e2e-secret')
      },
      async () => {
        throw new Error('switch back failed')
      },
      'e2e-secret'
    ).catch((e: unknown) => e as AggregateError)
    expect(err).toBeInstanceOf(AggregateError)
    expect(err.message).toBe('step failed with <password>; and then switching back to the smoke account failed: switch back failed')
    expect(err.errors.map(e => String(e))).toEqual(['Error: step failed with <password>', 'Error: switch back failed'])
  })

  test('a failed step after a passing restore throws the step error without the secret', async () => {
    let restored = false
    const err = await thenRestore(
      async () => Promise.reject(new Error('step failed with e2e-secret')),
      async () => {
        restored = true
      },
      'e2e-secret'
    ).catch((e: unknown) => e as Error)
    expect(restored).toBe(true)
    expect(err.message).toBe('step failed with <password>')
    expect(err.cause).toBeUndefined()
  })

  test('a failed restore after a passing step throws the restore error', async () => {
    await expect(thenRestore(async () => 1, async () => Promise.reject(new Error('switch back failed')))).rejects.toThrow('switch back failed')
  })

  test('the restore runs after a failed step that it does not hide', async () => {
    let restored = false
    await expect(
      thenRestore(
        async () => Promise.reject(new Error('step failed')),
        async () => {
          restored = true
        }
      )
    ).rejects.toThrow('step failed')
    expect(restored).toBe(true)
  })
})

describe('hook budgets', () => {
  test('a hook running check-or-repair gives itself every step\'s worst case, far past the default 30s', () => {
    expect(CHECK_OR_REPAIR_WORST_MS).toBe(2 * CHECK_WORST_MS + REPAIR_WORST_MS)
    expect(REPAIR_WORST_MS).toBeGreaterThan(BACK_TO_SMOKE_WORST_MS)
    expect(CHECK_WORST_MS).toBeGreaterThan(BACK_TO_SMOKE_WORST_MS)
    expect(CHECK_OR_REPAIR_WORST_MS).toBeGreaterThan(30_000 * 10)
  })
})

describe('settlePendingSecondPassword', () => {
  let dir = ''
  let file = ''
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-pw-'))
    fs.chmodSync(dir, 0o700)
    file = path.join(dir, 'env')
  })
  afterEach(() => fs.rmSync(dir, {force: true, recursive: true}))
  const holds = (current: ReadonlyArray<string>) => async (_e: unknown, pw: string) => current.includes(pw)

  test('promotes KB_SECOND_PASSWORD_NEXT when the server holds it', async () => {
    fs.writeFileSync(file, "export KB_SECOND_PASSWORD='old-pw'\nexport KB_SECOND_PASSWORD_NEXT='new-pw'\n", {mode: 0o600})
    await expect(settlePendingSecondPassword(env, file, holds(['new-pw']))).resolves.toBe('promoted')
    expect(readEnvFile(file)['KB_SECOND_PASSWORD']).toBe('new-pw')
    expect(readEnvFile(file)['KB_SECOND_PASSWORD_NEXT']).toBeUndefined()
  })

  test('drops KB_SECOND_PASSWORD_NEXT when the server still holds the old one', async () => {
    fs.writeFileSync(file, "export KB_SECOND_PASSWORD='old-pw'\nexport KB_SECOND_PASSWORD_NEXT='new-pw'\n", {mode: 0o600})
    await expect(settlePendingSecondPassword(env, file, holds(['old-pw']))).resolves.toBe('dropped')
    expect(readEnvFile(file)['KB_SECOND_PASSWORD']).toBe('old-pw')
    expect(readEnvFile(file)['KB_SECOND_PASSWORD_NEXT']).toBeUndefined()
  })

  // the iOS afterEach: a change the phone sent may still be on its way to the server
  describe('when it may not drop', () => {
    const text = "export KB_SECOND_PASSWORD='old-pw'\nexport KB_SECOND_PASSWORD_NEXT='new-pw'\n"
    const sent = async () => Promise.resolve(false)
    const neverSent = async () => Promise.resolve(true)

    test('a change sent and not yet applied: KB_SECOND_PASSWORD_NEXT stays and the owner runs --check', async () => {
      fs.writeFileSync(file, text, {mode: 0o600})
      const err = await settlePendingSecondPassword(env, file, holds(['old-pw']), sent).then(
        () => new Error('it passed'),
        (e: unknown) => e as Error
      )
      expect(err.message).toMatch(/yarn test:e2e:accounts:second-password --check/)
      expect(err.message).not.toMatch(/old-pw|new-pw/)
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    })

    test('a change applied: KB_SECOND_PASSWORD_NEXT is promoted', async () => {
      fs.writeFileSync(file, text, {mode: 0o600})
      await expect(settlePendingSecondPassword(env, file, holds(['new-pw']), sent)).resolves.toBe('promoted')
      expect(readEnvFile(file)['KB_SECOND_PASSWORD']).toBe('new-pw')
      expect(readEnvFile(file)['KB_SECOND_PASSWORD_NEXT']).toBeUndefined()
    })

    test('a change never sent: KB_SECOND_PASSWORD_NEXT is dropped', async () => {
      fs.writeFileSync(file, text, {mode: 0o600})
      await expect(settlePendingSecondPassword(env, file, holds(['old-pw']), neverSent)).resolves.toBe('dropped')
      expect(readEnvFile(file)['KB_SECOND_PASSWORD']).toBe('old-pw')
      expect(readEnvFile(file)['KB_SECOND_PASSWORD_NEXT']).toBeUndefined()
    })

    test('a call log that cannot be read changes nothing', async () => {
      fs.writeFileSync(file, text, {mode: 0o600})
      const unreadable = async () => Promise.reject(new Error('the call log is gone'))
      await expect(settlePendingSecondPassword(env, file, holds(['old-pw']), unreadable)).rejects.toThrow(/call log/)
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    })
  })

  test('changes nothing, naming no password, when neither or both check, or when none is pending', async () => {
    const text = "export KB_SECOND_PASSWORD='old-pw'\nexport KB_SECOND_PASSWORD_NEXT='new-pw'\n"
    for (const current of [[], ['old-pw', 'new-pw']]) {
      fs.writeFileSync(file, text, {mode: 0o600})
      const err = await settlePendingSecondPassword(env, file, holds(current)).then(() => new Error('it passed'), (e: unknown) => e as Error)
      expect(err.message).toMatch(/settle it by hand/)
      expect(err.message).not.toMatch(/old-pw|new-pw/)
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    }
    fs.writeFileSync(file, "export KB_SECOND_PASSWORD='old-pw'\n", {mode: 0o600})
    await expect(settlePendingSecondPassword(env, file, holds([]))).resolves.toBe('none')
  })
})
