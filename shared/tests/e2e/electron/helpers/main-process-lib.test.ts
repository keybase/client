import {cdpEvaluate, consoleLocked, electronMainPid, inspectorUrl, parseEvaluateReply, serviceSocketFds} from './main-process-lib'

describe('inspectorUrl', () => {
  test('picks the node target', () => {
    const list = [
      {type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/page'},
      {type: 'node', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/abc'},
    ]
    expect(inspectorUrl(list)).toBe('ws://127.0.0.1:9229/abc')
  })
  test('refuses a list without a node target, or one off localhost', () => {
    expect(() => inspectorUrl([])).toThrow(/no node target/)
    expect(() => inspectorUrl({})).toThrow(/no node target/)
    expect(() => inspectorUrl([{type: 'node', webSocketDebuggerUrl: 'ws://0.0.0.0:9229/abc'}])).toThrow(/127\.0\.0\.1/)
  })
})

describe('cdpEvaluate', () => {
  test('awaits the expression and returns it by value', () => {
    const m = JSON.parse(cdpEvaluate(7, '1 + 1')) as {id: number; method: string; params: {expression: string; awaitPromise: boolean; returnByValue: boolean}}
    expect(m.id).toBe(7)
    expect(m.method).toBe('Runtime.evaluate')
    expect(m.params.awaitPromise).toBe(true)
    expect(m.params.returnByValue).toBe(true)
    expect(m.params.expression).toContain('1 + 1')
  })
})

describe('parseEvaluateReply', () => {
  test('returns the value', () => {
    expect(parseEvaluateReply({id: 1, result: {result: {type: 'string', value: '45.0.0'}}})).toBe('45.0.0')
    expect(parseEvaluateReply({id: 1, result: {result: {type: 'undefined'}}})).toBeUndefined()
  })
  test('throws the exception text', () => {
    const reply = {
      id: 1,
      result: {
        exceptionDetails: {exception: {description: 'Error: boom\n    at <anonymous>:1:7'}, text: 'Uncaught'},
        result: {subtype: 'error', type: 'object'},
      },
    }
    expect(() => parseEvaluateReply(reply)).toThrow(/Uncaught.*Error: boom/)
  })
  test('throws a protocol error', () => {
    expect(() => parseEvaluateReply({error: {code: -32000, message: 'no such context'}, id: 1})).toThrow(/no such context/)
  })
})

describe('electronMainPid', () => {
  const ps = [
    '87163 87163 node /opt/homebrew/bin/yarn.js desktop:start:hot:e2e',
    // a helper listed ahead of the main process (its pid wrapped around below it)
    '37056 87163 /x/node_modules/electron/dist/Electron.app/Contents/Frameworks/Electron Helper (Renderer).app/Contents/MacOS/Electron Helper (Renderer) --type=renderer',
    '87166 87163 /x/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron --remote-debugging-port=9222 /x/desktop/dist/node.dev',
    '87167 87163 /x/node_modules/electron/dist/Electron.app/Contents/Frameworks/Electron Helper.app/Contents/MacOS/Electron Helper --type=gpu-process',
    '99999 4242 /x/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron other-group',
  ].join('\n')
  test('finds the group member that is the Electron binary itself, not a helper', () => {
    expect(electronMainPid(ps, 87163)).toBe(87166)
  })
  test('throws when the group has none', () => {
    expect(() => electronMainPid(ps, 5)).toThrow(/process group 5/)
  })
})

describe('serviceSocketFds', () => {
  const sock = '/Users/testuser/Library/Caches/Keybase/keybased.sock'
  const lsof = [
    'COMMAND    PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
    `keybase   200 testuser   11u  unix 0x0aa      0t0      ${sock}`,
    `keybase   200 testuser   25u  unix 0x0bb      0t0      ${sock}`,
    'keybase   300 testuser   25u  unix 0x0cc      0t0      /Users/testuser/.config/keybase-e2e/homes/second/Library/Caches/Keybase/keybased.sock',
    'Electron  100 testuser   16u  unix 0x111      0t0      ->0x0bb',
    'Electron  100 testuser   17u  unix 0x112      0t0      ->0x0cc',
    'Electron  100 testuser   18u  unix 0x113      0t0      ->0x0aa',
    'other     400 testuser   9u   unix 0x114      0t0      ->0x0bb',
  ].join('\n')
  test('the fds of the pid whose peer is a socket bound to the path', () => {
    expect(serviceSocketFds(lsof, 100, sock)).toEqual([16, 18])
  })
  test('none for another pid or path', () => {
    expect(serviceSocketFds(lsof, 101, sock)).toEqual([])
    expect(serviceSocketFds(lsof, 100, '/nowhere.sock')).toEqual([])
  })
})

describe('consoleLocked', () => {
  test('reads the root entry', () => {
    expect(consoleLocked('+-o Root  <class IORegistryEntry>\n    {\n      "IOConsoleLocked" = Yes\n    }')).toBe(true)
    expect(consoleLocked('    {\n      "IOConsoleLocked" = No\n    }')).toBe(false)
  })
  test('refuses output without it', () => {
    expect(() => consoleLocked('+-o Root')).toThrow(/IOConsoleLocked/)
  })
})
