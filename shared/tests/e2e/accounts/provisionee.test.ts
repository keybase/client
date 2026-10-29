import {ProvisioneeOutput} from './provisionee'

// what a CLI might print around its phrase: the device list, the account name, the phrase itself
const buffer = [
  '\t1. [computer]\tMac Deviceair',
  'Logged in as testuser',
  'Type this verification code into your other device:',
  '\talpha bravo charlie delta echo foxtrot golf hotel',
]
const words = ['Deviceair', 'testuser', 'alpha', 'hotel', 'verification']

describe('ProvisioneeOutput', () => {
  test('an end before the phrase gives an error holding none of the CLI output', () => {
    const out = new ProvisioneeOutput()
    // a script that leaked its buffer into a stage line, or printed it raw, changes nothing
    out.feed(`STAGE ended-before-phrase: ${buffer.join('\n')}\n`)
    out.feed(`${buffer.join('\n')}\n`)
    out.feed('STAGE ended-before-phrase\n')
    const message = out.exitError(4).message
    expect(message).toBe('keybase login exited 4 (ended-before-phrase)')
    for (const w of words) expect(message).not.toContain(w)
    expect(out.phrase).toBe('')
  })
  test('takes the phrase only from its own marker line', () => {
    const out = new ProvisioneeOutput()
    out.feed('PHRASE alpha bravo charlie delta echo foxtrot golf hotel\n')
    expect(out.phrase).toBe('alpha bravo charlie delta echo foxtrot golf hotel')
    out.feed('STAGE timeout-after-phrase\n')
    expect(out.exitError(2).message).toBe('keybase login exited 2 (timeout-after-phrase)')
  })
  test('ignores an unknown stage and a malformed phrase line', () => {
    const out = new ProvisioneeOutput()
    out.feed('STAGE something-else alpha bravo\nPHRASE Not A Phrase!\n')
    expect(out.phrase).toBe('')
    expect(out.exitError(1).message).toBe('keybase login exited 1')
  })
  test('joins lines split across chunks', () => {
    const out = new ProvisioneeOutput()
    out.feed('PHRASE alpha bra')
    out.feed('vo\n')
    expect(out.phrase).toBe('alpha bravo')
  })
})
