import {deviceRowPredicate, deviceRowsIn, mergeRows, rowDevice, showsRevokedDivider} from './devices-lib'

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
