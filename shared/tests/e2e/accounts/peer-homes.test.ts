import {EventEmitter} from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  checkRetirablePeerHome,
  checkRevocable,
  checkStoppablePeerHome,
  homeServicePids,
  peerHomeRoots,
  revokeWithHomeStopped,
  restoreMainAccount,
  retirePeerHome,
  stopPeerHomeService,
  withSignalsDeferred,
} from './peer-homes'
import {peerConfigPath} from '../shared/peer-service'

let dir = ''
let root = ''
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'peer-homes-')))
  root = path.join(dir, 'homes') + path.sep
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

const makeHome = (p: string, cfg: object = {current_user: 'testuser', users: {testuser: {device: 'old1'}}}) => {
  fs.mkdirSync(path.dirname(peerConfigPath(p)), {recursive: true})
  fs.writeFileSync(peerConfigPath(p), JSON.stringify(cfg))
  return p
}

const deps = () => ({
  remove: jest.fn(async () => Promise.resolve()),
  revoke: jest.fn(async () => Promise.resolve()),
  say: jest.fn(),
  stop: jest.fn(async () => Promise.resolve()),
})

describe('retirePeerHome', () => {
  test('refuses the home directory itself without stopping anything', async () => {
    const homeDir = makeHome(path.join(dir, 'user'))
    const d = deps()
    await expect(
      retirePeerHome({newHome: `${root}second`, oldHome: homeDir, role: 'second', user: 'testuser'}, d, {homeDir, roots: [root]})
    ).rejects.toThrow(/refusing to retire .*home directory/)
    expect(d.stop).not.toHaveBeenCalled()
    expect(d.revoke).not.toHaveBeenCalled()
    expect(d.remove).not.toHaveBeenCalled()
  })

  test('refuses a directory outside the peer roots without stopping anything', async () => {
    const outside = makeHome(path.join(dir, 'elsewhere', 'second'))
    const d = deps()
    await expect(
      retirePeerHome({newHome: `${root}second`, oldHome: outside, role: 'second', user: 'testuser'}, d, {
        homeDir: path.join(dir, 'user'),
        roots: [root],
      })
    ).rejects.toThrow(/not inside an e2e peer home root/)
    expect(d.stop).not.toHaveBeenCalled()
  })

  test('stops, then revokes the recorded device, then removes a valid old home', async () => {
    const old = makeHome(`${root}second.old`)
    const order: string[] = []
    const d = {
      remove: jest.fn(async () => Promise.resolve(void order.push('remove'))),
      revoke: jest.fn(async (id: string) => Promise.resolve(void order.push(`revoke ${id}`))),
      say: jest.fn(),
      stop: jest.fn(async () => Promise.resolve(void order.push('stop'))),
    }
    await retirePeerHome({newHome: `${root}second`, oldHome: old, role: 'second', user: 'testuser'}, d, {
      homeDir: path.join(dir, 'user'),
      roots: [root],
    })
    expect(order).toEqual(['stop', 'revoke old1', 'remove'])
  })
})

describe('checkRetirablePeerHome', () => {
  const opts = () => ({homeDir: path.join(dir, 'user'), roots: [root]})
  test('refuses relative, unnormalised, the replacing home, a parent of the home dir and a config-less dir', () => {
    makeHome(`${root}second`)
    expect(() => checkRetirablePeerHome('homes/second', `${root}x`, opts())).toThrow(/absolute/)
    expect(() => checkRetirablePeerHome(`${root}x/../second`, `${root}x`, opts())).toThrow(/normalised/)
    expect(() => checkRetirablePeerHome(`${root}second`, `${root}second`, opts())).toThrow(/current peer home/)
    expect(() => checkRetirablePeerHome(dir, `${root}x`, {homeDir: path.join(dir, 'user'), roots: [dir]})).toThrow()
    fs.mkdirSync(`${root}bare`)
    expect(() => checkRetirablePeerHome(`${root}bare`, `${root}x`, opts())).toThrow(/no keybase config/)
    expect(checkRetirablePeerHome(`${root}second`, `${root}x`, opts())).toBe(`${root}second`)
  })

  test('the only root is the e2e config homes dir: no /tmp root', () => {
    expect(peerHomeRoots()).toEqual([path.join(os.homedir(), '.config', 'keybase-e2e', 'homes') + path.sep])
  })

  test('refuses a symlinked home, even one that points at a valid home', () => {
    const real = makeHome(`${root}second`)
    fs.symlinkSync(real, `${root}link`)
    expect(() => checkRetirablePeerHome(`${root}link`, `${root}x`, opts())).toThrow(/symlink/)
    // a link from inside the root to a home outside it
    const outside = makeHome(path.join(dir, 'elsewhere', 'second'))
    fs.symlinkSync(outside, `${root}out`)
    expect(() => checkRetirablePeerHome(`${root}out`, `${root}x`, opts())).toThrow(/symlink/)
  })

  test('refuses a home reached through a symlinked parent', () => {
    makeHome(path.join(dir, 'elsewhere', 'nested', 'second'))
    fs.mkdirSync(root, {recursive: true})
    fs.symlinkSync(path.join(dir, 'elsewhere', 'nested'), `${root}nested`)
    expect(() => checkRetirablePeerHome(`${root}nested/second`, `${root}x`, opts())).toThrow(/symlink/)
  })

  test('refuses a home under a root that is itself a symlink', () => {
    const realRoot = path.join(dir, 'realroot') + path.sep
    makeHome(`${realRoot}second`)
    const linkRoot = path.join(dir, 'linkroot')
    fs.symlinkSync(realRoot, linkRoot)
    expect(() =>
      checkRetirablePeerHome(`${linkRoot}/second`, `${root}x`, {homeDir: path.join(dir, 'user'), roots: [linkRoot + path.sep]})
    ).toThrow(/symlink/)
  })
})

describe('homeServicePids', () => {
  const home = '/x/homes/prov-0abcd1'
  test('finds the processes started with --home <home>, in either form', () => {
    const ps = [
      '  101 /bin/keybase --home /x/homes/prov-0abcd1 -d --log-file=/x/homes/prov-0abcd1/service.log service',
      '  102 /bin/keybase --home=/x/homes/prov-0abcd1 service',
      '  103 /bin/keybase --home /x/homes/prov-0abcd1x service',
      '  104 /bin/keybase --home /x/homes/second service',
      '  105 /bin/keybase service',
      '',
    ].join('\n')
    expect(homeServicePids(ps, home)).toEqual([101, 102])
  })
  test('finds nothing in an empty listing', () => {
    expect(homeServicePids('', home)).toEqual([])
  })
})

describe('revokeWithHomeStopped', () => {
  const home = '/x/homes/prov-0abcd1'
  const deps = (s: {answers: Array<boolean>; pids: Array<Array<number>>}) => {
    const order: Array<string> = []
    return {
      d: {
        answers: jest.fn(async () => Promise.resolve(s.answers.shift() ?? false)),
        pids: jest.fn(() => s.pids.shift() ?? []),
        revoke: jest.fn(async () => Promise.resolve(void order.push('revoke'))),
        stop: jest.fn(async () => Promise.resolve(void order.push('stop'))),
      },
      order,
    }
  }
  test('revokes at once when no process runs for the home', async () => {
    const {d, order} = deps({answers: [false, false], pids: [[]]})
    await revokeWithHomeStopped(home, d)
    expect(order).toEqual(['revoke'])
  })
  test('stops a service that still answers (a home that still exists), then revokes', async () => {
    const {d, order} = deps({answers: [true, false], pids: [[]]})
    await revokeWithHomeStopped(home, d)
    expect(d.stop).toHaveBeenCalledWith(home)
    expect(order).toEqual(['stop', 'revoke'])
  })
  test('refuses when a service still answers after the stop (a home that still exists)', async () => {
    const {d} = deps({answers: [true, true], pids: [[]]})
    await expect(revokeWithHomeStopped(home, d)).rejects.toThrow(/refusing to revoke.*still answers/)
    expect(d.revoke).not.toHaveBeenCalled()
  })
  test('refuses while a process for a gone home still runs: no socket answers, so only the pid check guards', async () => {
    const {d} = deps({answers: [false, false], pids: [[4242]]})
    await expect(revokeWithHomeStopped(home, d)).rejects.toThrow(/refusing to revoke.*pid 4242/)
    expect(d.stop).not.toHaveBeenCalled()
    expect(d.revoke).not.toHaveBeenCalled()
  })
})

describe('checkRevocable', () => {
  test('refuses when an in-use device id is unknown', () => {
    expect(() => checkRevocable('old1', '', 'main1')).toThrow(/unknown/)
    expect(() => checkRevocable('old1', 'peer1', '')).toThrow(/unknown/)
    expect(() => checkRevocable('', 'peer1', 'main1')).toThrow(/unknown/)
  })
  test('refuses a device in use and allows another', () => {
    expect(() => checkRevocable('peer1', 'peer1', 'main1')).toThrow(/in use/)
    expect(() => checkRevocable('main1', 'peer1', 'main1')).toThrow(/in use/)
    expect(() => checkRevocable('old1', 'peer1', 'main1')).not.toThrow()
  })
})

describe('withSignalsDeferred', () => {
  test('a SIGINT during the work waits for restore, then exits non-zero', async () => {
    const signals = new EventEmitter()
    const events: string[] = []
    const exit = jest.fn((code: number) => void events.push(`exit ${code}`))
    const result = await withSignalsDeferred(
      async () => {
        signals.emit('SIGINT')
        events.push('work done')
        return Promise.resolve('key')
      },
      async () => Promise.resolve(void events.push('restored')),
      {exit, signals}
    )
    expect(result).toBe('key')
    expect(events).toEqual(['work done', 'restored', 'exit 130'])
    expect(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM')).toBe(0)
  })

  test('a SIGTERM during a failing restore still exits non-zero', async () => {
    const signals = new EventEmitter()
    const exit = jest.fn()
    await expect(
      withSignalsDeferred(
        async () => Promise.resolve(signals.emit('SIGTERM')),
        async () => Promise.reject(new Error('switch back failed')),
        {exit, signals}
      )
    ).rejects.toThrow('switch back failed')
    expect(exit).toHaveBeenCalledWith(143)
  })

  test('without a signal it restores after a failing work and never exits', async () => {
    const signals = new EventEmitter()
    const exit = jest.fn()
    const restore = jest.fn(async () => Promise.resolve())
    await expect(withSignalsDeferred(async () => Promise.reject(new Error('boom')), restore, {exit, signals})).rejects.toThrow(
      'boom'
    )
    expect(restore).toHaveBeenCalledTimes(1)
    expect(exit).not.toHaveBeenCalled()
    expect(signals.listenerCount('SIGINT')).toBe(0)
  })
})

describe('withSignalsDeferred and a second Ctrl-C', () => {
  test('a second SIGINT during restore is held too: restore finishes before the exit', async () => {
    const signals = new EventEmitter()
    const events: string[] = []
    const exit = jest.fn((code: number) => void events.push(`exit ${code}`))
    await withSignalsDeferred(
      async () => Promise.resolve(void signals.emit('SIGINT')),
      async () => {
        signals.emit('SIGINT')
        await Promise.resolve()
        events.push('restored')
      },
      {exit, signals}
    )
    expect(events).toEqual(['restored', 'exit 130'])
  })

  test('a restore that gives up says why before the signal exit', async () => {
    const signals = new EventEmitter()
    const events: string[] = []
    await expect(
      withSignalsDeferred(
        async () => Promise.resolve(void signals.emit('SIGINT')),
        async () => Promise.reject(new Error('still not back; run: fix-it')),
        {exit: code => void events.push(`exit ${code}`), say: s => void events.push(s), signals}
      )
    ).rejects.toThrow('fix-it')
    expect(events.at(-2)).toContain('still not back; run: fix-it')
    expect(events.at(-1)).toBe('exit 130')
  })
})

describe('restoreMainAccount', () => {
  const fake = (states: Array<string>, switchFails: number) => {
    let who = states.shift() ?? ''
    let fails = switchFails
    const calls: string[] = []
    return {
      calls,
      deps: {
        sleep: async () => Promise.resolve(),
        switchTo: async (user: string) => {
          calls.push(`switch ${user}`)
          if (fails-- > 0) throw new Error('keybase login --switch: killed')
          who = user
          return Promise.resolve()
        },
        whoami: async () => Promise.resolve(who),
      },
    }
  }

  test('already on the smoke account: no switch', async () => {
    const f = fake(['testuser'], 0)
    await restoreMainAccount('testuser', 'fix-cmd', f.deps)
    expect(f.calls).toEqual([])
  })

  test('a switch that fails once is retried until the main service is back', async () => {
    const f = fake(['testuser-mac'], 1)
    const said: string[] = []
    await restoreMainAccount('testuser', 'fix-cmd', {...f.deps, say: s => void said.push(s)})
    expect(f.calls).toEqual(['switch testuser', 'switch testuser'])
    expect(said.join('\n')).toContain('attempt 1 of 3')
  })

  test('gives up after 3 attempts naming the command that fixes it', async () => {
    const f = fake(['testuser-mac'], 99)
    await expect(restoreMainAccount('testuser', 'fix-cmd', f.deps)).rejects.toThrow(/after 3 attempts.*fix-cmd/s)
    expect(f.calls).toHaveLength(3)
  })

  test('stops retrying at the deadline', async () => {
    const f = fake(['testuser-mac'], 99)
    let t = 0
    const now = () => t
    await expect(
      restoreMainAccount('testuser', 'fix-cmd', {...f.deps, now, sleep: async () => Promise.resolve(void (t += 60_000))}, {deadlineMs: 90_000})
    ).rejects.toThrow('fix-cmd')
    expect(f.calls).toHaveLength(2)
  })
})

describe('checkStoppablePeerHome', () => {
  const opts = () => ({homeDir: path.join(dir, 'user'), roots: [root]})
  test('refuses the main home, a parent of it, anything outside the roots, and unnormalised paths', () => {
    expect(() => checkStoppablePeerHome(path.join(dir, 'user'), opts())).toThrow(/home directory/)
    expect(() => checkStoppablePeerHome(dir, {homeDir: path.join(dir, 'user'), roots: [dir + path.sep]})).toThrow()
    expect(() => checkStoppablePeerHome(path.join(dir, 'elsewhere'), opts())).toThrow(/not inside an e2e peer home root/)
    expect(() => checkStoppablePeerHome(root, opts())).toThrow(/not inside/)
    expect(() => checkStoppablePeerHome(`${root}x/../second`, opts())).toThrow(/normalised/)
    expect(() => checkStoppablePeerHome('', opts())).toThrow(/absolute/)
  })
  test('passes a home inside a root', () => {
    expect(checkStoppablePeerHome(`${root}second`, opts())).toBe(`${root}second`)
  })
  test("stopPeerHomeService refuses the user's home before touching any service", async () => {
    await expect(stopPeerHomeService(os.homedir())).rejects.toThrow(/home directory/)
  })
})
