import {isMobile} from '../../constants/platform'
import libphonenumber from 'google-libphonenumber'
import countries from './country-data/countries.json'
import _supportedCodes from './sms-support/data.json'
import {emojiIndexByChar} from '../../common-adapters/markdown/emoji-gen'

const supportedCodes: {[key: string]: boolean} = _supportedCodes
const PNF = libphonenumber.PhoneNumberFormat
export const PhoneNumberFormat = PNF

export const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance()
export const ValidationResult = libphonenumber.PhoneNumberUtil.ValidationResult
const supported = phoneUtil.getSupportedRegions()

export type CountryData = {
  alpha2: string
  callingCode: string
  emoji: string
  emojiText: string
  example: string
  name: string
  pickerText: string
}

let countryDataRaw: {[key: string]: CountryData} = {}
let codeToCountryRaw: {[key: string]: string} = {}

countries.forEach(curr => {
  if (
    curr.alpha2 &&
    (curr.status === 'assigned' || curr.status === 'user assigned') &&
    supportedCodes[curr.alpha2] &&
    curr.countryCallingCodes.length &&
    supported.includes(curr.alpha2)
  ) {
    // @ts-ignore
    const emojiText: string = emojiIndexByChar[curr.emoji || -1] || ''
    // see here for why we check status is 'assigned'
    // https://github.com/OpenBookPrices/country-data/tree/011dbb6658b0df5a36690af7086baa3e5c20c30c#status-notes
    countryDataRaw[curr.alpha2] = {
      alpha2: curr.alpha2,
      callingCode: curr.countryCallingCodes[0],
      emoji: curr.emoji || '',
      emojiText,
      example: phoneUtil.format(phoneUtil.getExampleNumber(curr.alpha2), PNF.NATIONAL),
      name: curr.name,
      pickerText:
        (isMobile ? `${curr.emoji} ` : '') +
        `${curr.name} ${curr.countryCallingCodes[0].replace(' ', '\xa0')}`,
    }

    for (const code of curr.countryCallingCodes) {
      codeToCountryRaw[code.slice(1)] = curr.alpha2
    }
  }
})

export const countryData: {[key: string]: CountryData} = countryDataRaw
export const codeToCountry: {[key: string]: string} = codeToCountryRaw

const canadianAreaCodes: {[key: string]: boolean} = {
  '204': true,
  '226': true,
  '236': true,
  '249': true,
  '250': true,
  '289': true,
  '306': true,
  '343': true,
  '365': true,
  '403': true,
  '416': true,
  '418': true,
  '431': true,
  '437': true,
  '438': true,
  '450': true,
  '506': true,
  '514': true,
  '519': true,
  '548': true,
  '579': true,
  '581': true,
  '587': true,
  '604': true,
  '613': true,
  '639': true,
  '647': true,
  '672': true,
  '705': true,
  '709': true,
  '778': true,
  '780': true,
  '782': true,
  '807': true,
  '819': true,
  '825': true,
  '867': true,
  '873': true,
  '902': true,
  '905': true,
}

export const areaCodeIsCanadian = (input: string): boolean => {
  return !!canadianAreaCodes[input]
}

export const validateNumber = (rawNumber: string, region?: string | null) => {
  try {
    const phoneNumber = phoneUtil.parse(rawNumber, region || '')
    const valid = phoneUtil.isValidNumber(phoneNumber)
    return {
      e164: phoneUtil.format(phoneNumber, PNF.E164),
      phoneNumber,
      valid,
    }
  } catch (e) {
    return {e164: '', valid: false}
  }
}

export const formatPhoneNumber = (rawNumber: string) => {
  const phoneNumber = phoneUtil.parse(rawNumber, '')
  return `+${phoneNumber.getCountryCode()} ${phoneUtil.format(phoneNumber, PNF.NATIONAL)}`
}

export const formatAnyPhoneNumbers = (rawText: string) => {
  const found = rawText.match(/(\+)?(\d)+/)
  const rawNumber = found ? found[0] : ''
  const validatedNumber = validateNumber(rawNumber)
  const phoneNumber = validatedNumber.phoneNumber
  if (!validatedNumber.valid || !phoneNumber) return rawText
  const replacement = `+${phoneNumber.getCountryCode()} ${phoneUtil.format(phoneNumber, PNF.NATIONAL)}`
  return rawText.replace(rawNumber, replacement)
}

// Return phone number in international format, e.g. +1 800 555 0123
// or e.164 if parsing fails
export const e164ToDisplay = (e164: string): string => {
  try {
    const phoneNumber = phoneUtil.parse(e164)
    if (phoneNumber.getCountryCode() === 1) {
      return '+1 ' + phoneUtil.format(phoneNumber, PNF.NATIONAL)
    }
    return phoneUtil.format(phoneNumber, PNF.INTERNATIONAL)
  } catch (e) {
    return e164
  }
}

export const AsYouTypeFormatter = libphonenumber.AsYouTypeFormatter

export const formatPhoneNumberInternational = (rawNumber: string): string | undefined => {
  try {
    const phoneNumber = phoneUtil.parse(rawNumber)
    return phoneUtil.format(phoneNumber, PNF.INTERNATIONAL)
  } catch {
    return undefined
  }
}
