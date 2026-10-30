import {deviceListProblem, deviceRowPredicate, deviceRowsIn, mergeRows, paperKeyMasked, rowDevice, showsRevokedDivider} from './devices-lib'

const row = (label: string, y: number, visible = true) =>
  `<XCUIElementTypeOther type="XCUIElementTypeOther" name="devices-row" label="${label}" enabled="true" visible="${visible}" accessible="true" x="0" y="${y}" width="402" height="56" index="0" traits="">`

describe('deviceRowsIn', () => {
  test('reads the rows top to bottom with their labels decoded, and nothing else', () => {
    const source = [
      '<XCUIElementTypeApplication type="XCUIElementTypeApplication" name="Keybase" label="Keybase">',
      row('b &amp; c , Last used 2 days ago', 276, false),
      row('phone (Current device), Last used 1 minute ago', 180),
      '<XCUIElementTypeOther type="XCUIElementTypeOther" name="devices-row-last-used" visible="true" y="200"/>',
    ].join('\n')
    expect(deviceRowsIn(source)).toEqual([
      {label: 'phone (Current device), Last used 1 minute ago', visible: true, y: 180},
      {label: 'b & c , Last used 2 days ago', visible: false, y: 276},
    ])
  })

  test('sees the revoked divider', () => {
    expect(showsRevokedDivider('<XCUIElementTypeOther type="XCUIElementTypeOther" name="Revoked devices" label="Revoked devices">')).toBe(true)
    expect(showsRevokedDivider(row('a , Last used today', 1))).toBe(false)
  })
})

describe('rowDevice', () => {
  test('the phone, another active device, a new one and a revoked one', () => {
    expect(rowDevice('iOS Device7ff7 (Current device), Last used 1 minute ago')).toEqual({active: true, current: true, name: 'iOS Device7ff7'})
    expect(rowDevice('Android Device hg dgj , Last used over 3 years ago')).toEqual({active: true, current: false, name: 'Android Device hg dgj'})
    expect(rowDevice('e2e-98s0b1-cli , NEW, Last used unknown')).toEqual({active: true, current: false, name: 'e2e-98s0b1-cli'})
    expect(rowDevice('apple banana , Revoked 2 minutes ago')).toEqual({active: false, current: false, name: 'apple banana'})
  })

  test('a label that is no device row', () => {
    expect(rowDevice('Revoked devices')).toBeUndefined()
    expect(rowDevice('a , b')).toBeUndefined()
  })
})

describe('mergeRows', () => {
  test('appends what follows the last collected row', () => {
    expect(mergeRows([], ['a', 'b'])).toEqual(['a', 'b'])
    expect(mergeRows(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(mergeRows(['a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  test('refuses a screen that skipped rows', () => {
    expect(() => mergeRows(['a', 'b'], ['d', 'e'])).toThrow(/scrolled past rows/)
  })
})

describe('deviceRowPredicate', () => {
  test('matches the exact name with its separator, quotes escaped', () => {
    expect(deviceRowPredicate('a "b"')).toBe(
      '-ios predicate string:name == "devices-row" AND (label BEGINSWITH "a \\"b\\" , " OR label BEGINSWITH "a \\"b\\" (Current device), ")'
    )
  })
})

describe('paper key names stay out of messages', () => {
  const history = [
    {name: 'phone', type: 'mobile'},
    {name: 'laptop', type: 'desktop'},
    {name: 'apple banana', type: 'backup'},
    {name: 'cherry date', type: 'backup'},
  ]

  test('a skipped screen names a paper key only as one', () => {
    expect(() => mergeRows(['phone', 'apple banana'], ['laptop'], paperKeyMasked(history))).toThrow(
      'the list scrolled past rows: the next screen does not start at or before a paper key'
    )
  })

  test('deviceListProblem lists other devices by name and paper keys by count', () => {
    const active = history.slice(0, 3)
    expect(deviceListProblem(['phone', 'laptop', 'apple banana'], active, history)).toBeUndefined()
    const problem = deviceListProblem(['phone', 'cherry date'], active, history)
    expect(problem).toBe('the list does not show laptop, 1 paper key; the list shows 1 paper key, which the service does not list as active')
    expect(problem).not.toMatch(/apple|cherry/)
    expect(deviceListProblem(['phone', 'phone', 'laptop', 'apple banana'], active, history)).toBe('the list shows 1 name twice')
  })
})
