import {isMobile} from '../../constants/platform'
import libphonenumber from 'google-libphonenumber'
import countries from './country-data/countries.json'
import supportedCodes from './sms-support/data.json'
import {emojiIndexByChar} from '../../common-adapters/markdown/emoji-gen'

const PNF = libphonenumber.PhoneNumberFormat
export enum PhoneNumberFormat {
  E164 = PNF.E164,
}

export const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance()
const supported = phoneUtil.getSupportedRegions()

export const countryData = countries.reduce((res, curr) => {
  if (
    curr.alpha2 &&
    (curr.status === 'assigned' || curr.status === 'user assigned') &&
    supportedCodes[curr.alpha2] &&
    curr.countryCallingCodes.length &&
    supported.includes(curr.alpha2)
  ) {
    // see here for why we check status is 'assigned'
    // https://github.com/OpenBookPrices/country-data/tree/011dbb6658b0df5a36690af7086baa3e5c20c30c#status-notes
    res[curr.alpha2] = {
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
  }
  return res
}, {})

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
