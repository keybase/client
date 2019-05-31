/**
 * The upper part of file uses google-liphonenumber@3.2.2.
 * Uncomment it and remove the lower part when that dependency is added.
 */

// import libphonenumber from 'google-libphonenumber'
// import countries from './data/countries.json'

// const PNF = libphonenumber.PhoneNumberFormat
// export const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance()
// const supported = phoneUtil.getSupportedRegions()

// export const countryData = countries.reduce((res, curr) => {
//   if (
//     curr.alpha2 &&
//     curr.status === 'assigned' &&
//     curr.countryCallingCodes.length &&
//     supported.includes(curr.alpha2)
//   ) {
//     // see here for why we check status is 'assigned'
//     // https://github.com/OpenBookPrices/country-data/tree/011dbb6658b0df5a36690af7086baa3e5c20c30c#status-notes
//     res[curr.alpha2] = {
//       alpha2: curr.alpha2,
//       callingCode: curr.countryCallingCodes[0],
//       emoji: curr.emoji,
//       example: phoneUtil.format(phoneUtil.getExampleNumber(curr.alpha2), PNF.NATIONAL),
//       name: curr.name,
//       pickerText: `${curr.emoji} ${curr.name} ${curr.countryCallingCodes[0]}`,
//     }
//   }
//   return res
// }, {})

// export const validateNumber = (rawNumber: string, region: string) => {
//   try {
//     const number = phoneUtil.parse(rawNumber, region)
//     const valid = phoneUtil.isValidNumberForRegion(number, region)
//     return {
//       e164: phoneUtil.format(number, PNF.E164),
//       valid,
//     }
//   } catch (e) {
//     return {e164: '', valid: false}
//   }
// }

// export const AsYouTypeFormatter = libphonenumber.AsYouTypeFormatter

export const countryData = {
  US: {
    alpha2: 'US',
    callingCode: '+1',
    emoji: '🇺🇸',
    example: '(800) EXA-MPLE',
    name: 'United States',
    pickerText: '🇺🇸 United States +1',
  },
}

export const validateNumber = (rawNumber: string, region: string) => ({e164: '', valid: false})

export class AsYouTypeFormatter {
  region: string
  constructor(region: string) {
    this.region = region
  }
  inputDigit(_: string) {
    console.log('TODO')
  }
  clear() {
    console.log('TODO')
  }
}
