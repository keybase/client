import * as fs from 'fs'
import * as path from 'path'
import {clearGatePoison, gatePoisoned, isGatePoisonedBy, poisonCheckedFirst, poisonGate, requireGateNotPoisoned} from './poison-lib'

afterEach(() => {
  clearGatePoison('the proxy settings')
  clearGatePoison('lockdown mode')
})

test('an unpoisoned gate runs', () => {
  expect(gatePoisoned()).toBeUndefined()
  expect(() => requireGateNotPoisoned()).not.toThrow()
})

test('a poisoned gate refuses with every owner action, until each setting is put back', () => {
  poisonGate('the proxy settings', 'choose No proxy in Settings > Advanced')
  poisonGate('lockdown mode', 'turn it off in Settings > Advanced')
  expect(() => requireGateNotPoisoned()).toThrow(
    /^refusing to run: an earlier flow could not put back the proxy settings \(choose No proxy in Settings > Advanced\); lockdown mode \(turn it off in Settings > Advanced\), /
  )
  expect(isGatePoisonedBy('the proxy settings')).toBe(true)
  clearGatePoison('the proxy settings')
  expect(gatePoisoned()).toMatch(/lockdown mode/)
  expect(isGatePoisonedBy('the proxy settings')).toBe(false)
  expect(gatePoisoned()).not.toMatch(/proxy/)
  clearGatePoison('lockdown mode')
  expect(() => requireGateNotPoisoned()).not.toThrow()
})

test('poisoning the same setting twice keeps one entry, with the latest owner action', () => {
  poisonGate('lockdown mode', 'first')
  poisonGate('lockdown mode', 'second')
  expect(gatePoisoned()).toBe(
    'refusing to run: an earlier flow could not put back lockdown mode (second), so the phone may be broken for every later flow; put it back by hand and run the gate again'
  )
})

test('a hook wrapped by poisonCheckedFirst refuses before it runs, with its context, until the gate is put back', async () => {
  const ran: Array<unknown> = []
  const hook = poisonCheckedFirst(async function (this: {name: string}) {
    ran.push(this.name)
    return Promise.resolve(1)
  })
  poisonGate('lockdown mode', 'turn it off')
  await expect(hook.call({name: 'ctx'})).rejects.toThrow(/^refusing to run: an earlier flow could not put back lockdown mode/)
  expect(ran).toEqual([])
  clearGatePoison('lockdown mode')
  await expect(hook.call({name: 'ctx'})).resolves.toBe(1)
  expect(ran).toEqual(['ctx'])
})

// The gate's flow files declare their hooks through the globals gate/hooks.ts wraps, and hooks.ts
// wraps every before and beforeEach in poisonCheckedFirst, so each flow file's first hook checks the
// poison before it drives the app.
describe('every flow file of the gate checks the poison first', () => {
  const dir = path.join(__dirname, '..')
  const gate = fs.readFileSync(path.join(dir, 'gate.test.ts'), 'utf8')
  const imports = [...gate.matchAll(/^import '\.\/(.+)'$/gm)].map(m => m[1] ?? '')
  const flows = imports.filter(i => i.startsWith('flows/'))

  test('gate.test.ts loads the gate hooks before any flow', () => {
    expect(imports[0]).toBe('gate/hooks')
    expect(flows.length).toBeGreaterThan(30)
  })

  test("hooks.ts wraps the flows' before and beforeEach in the poison check", () => {
    const hooks = fs.readFileSync(path.join(dir, 'gate', 'hooks.ts'), 'utf8')
    expect(hooks).toContain("globalThis.before = declareHook(plain.before, 'poison')")
    expect(hooks).toContain("globalThis.beforeEach = declareHook(plain.beforeEach, 'poison')")
    expect(hooks).toMatch(/first === 'poison' \? poisonCheckedFirst\(fn\)/)
  })

  test('each flow declares its hooks through the wrapped globals only', () => {
    const bypassing = flows.filter(flow => {
      const text = fs.readFileSync(path.join(dir, `${flow}.ts`), 'utf8')
      return (
        /from ['"]mocha['"]|require\(['"]mocha['"]\)/.test(text) ||
        /\b(?:globalThis|global|Mocha)\.(?:before|beforeEach|suiteSetup|setup)\b|\b(?:suiteSetup|setup)\(/.test(text)
      )
    })
    expect(bypassing).toEqual([])
  })
})
