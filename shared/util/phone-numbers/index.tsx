import {isMobile} from '../../constants/platform'
import libphonenumber from 'google-libphonenumber'
import countries from './country-data/countries.json'
import supportedCodes from './sms-support/data.json'
import {emojiIndexByChar} from '../../common-adapters/markdown/emoji-gen'

const PNF = libphonenumber.PhoneNumberFormat
export const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance()
const supported = phoneUtil.getSupportedRegions()

let countryDataRaw = {}
let codeToCountryRaw = {}

countries.forEach(curr => {
  if (
    curr.alpha2 &&
    (curr.status === 'assigned' || curr.status === 'user assigned') &&
    supportedCodes[curr.alpha2] &&
    curr.countryCallingCodes.length &&
    supported.includes(curr.alpha2)
  ) {
    // see here for why we check status is 'assigned'
    // https://github.com/OpenBookPrices/country-data/tree/011dbb6658b0df5a36690af7086baa3e5c20c30c#status-notes
    countryData[curr.alpha2] = {
      alpha2: curr.alpha2,
      callingCode: curr.countryCallingCodes[0],
      emoji: curr.emoji,
      emojiText: emojiIndexByChar[curr.emoji],
      example: phoneUtil.format(phoneUtil.getExampleNumber(curr.alpha2), PNF.NATIONAL),
      name: curr.name,
      pickerText:
        (isMobile ? `${curr.emoji} ` : '') +
        `${curr.name} ${curr.countryCallingCodes[0].replace(' ', '\xa0')}`,
    }

    for (const code of curr.countryCallingCodes) {
      codeToCountry[code.slice(1)] = curr.alpha2
    }
  }
})

export const countryData = countryDataRaw
export const codeToCountry = codeToCountryRaw

const canadianAreaCodes = {
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

export const validateNumber = (rawNumber: string, region: string) => {
  try {
    const number = phoneUtil.parse(rawNumber, region)
    const valid = phoneUtil.isValidNumberForRegion(number, region)
    return {
      e164: phoneUtil.format(number, PNF.E164),
      valid,
    }
  } catch (e) {
    return {e164: '', valid: false}
  }
}

export const AsYouTypeFormatter = libphonenumber.AsYouTypeFormatter
