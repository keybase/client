/* eslint-env jest */
import {validateNumber, formatPhoneNumber, e164ToDisplay} from '../phone-numbers'

describe('validateNumber', () => {
  it('valid US number format but invalid area code', () => {
    expect(validateNumber('+15552802005', null)).toMatchObject({e164: '+15552802005', valid: false})
    expect(validateNumber('+15552802005', 'US')).toMatchObject({e164: '+15552802005', valid: false})
  })

  it('valid US number', () => {
    expect(validateNumber('+12015551112', null)).toMatchObject({e164: '+12015551112', valid: true})
    expect(validateNumber('+12015551113', 'US')).toMatchObject({e164: '+12015551113', valid: true})
    expect(validateNumber('2015551113', 'US')).toMatchObject({e164: '+12015551113', valid: true})

    expect(validateNumber('201 555 1113', 'US')).toMatchObject({e164: '+12015551113', valid: true})
    expect(validateNumber('+1 201 555 1113', 'US')).toMatchObject({e164: '+12015551113', valid: true})
  })

  it('valid PL number', () => {
    expect(validateNumber('+48784123123', null)).toMatchObject({e164: '+48784123123', valid: true})
    expect(validateNumber('+48784123123', 'PL')).toMatchObject({e164: '+48784123123', valid: true})
    expect(validateNumber('784123123', 'PL')).toMatchObject({e164: '+48784123123', valid: true})

    expect(validateNumber('784 123 123', 'PL')).toMatchObject({e164: '+48784123123', valid: true})
  })

  it('e164 from outer region', () => {
    // Someone should be able to ask for number from other region then they
    // are in, provided they use full E164 format with country code.
    expect(validateNumber('+48784123123', null)).toMatchObject({e164: '+48784123123', valid: true})
    expect(validateNumber('+48784123123', 'US')).toMatchObject({e164: '+48784123123', valid: true})
    expect(validateNumber('+12015551113', 'PL')).toMatchObject({e164: '+12015551113', valid: true})
  })

  it('formats phone numbers correctly', () => {
    expect(formatPhoneNumber('+48784123123')).toBe('+48 784 123 123')
    expect(formatPhoneNumber('+48123123123')).toBe('+48 12 312 31 23')
    expect(formatPhoneNumber('+12015551112')).toBe('+1 (201) 555-1112')
  })

  it('"displays" e164 numbers correctly', () => {
    expect(e164ToDisplay('+48784123123')).toBe('+48 784 123 123')
    expect(e164ToDisplay('+48123123123')).toBe('+48 12 312 31 23')
    expect(e164ToDisplay('+12015551112')).toBe('+1 (201) 555-1112')
  })
})
