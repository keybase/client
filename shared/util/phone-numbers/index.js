// @flow
import libphonenumber from 'google-libphonenumber'
import countries from './countries.json'

const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance()
const supported = phoneUtil.getSupportedRegions()

export const countryData = countries.reduce((res, curr) => {
  if (
    curr.alpha2 &&
    curr.status === 'assigned' &&
    curr.countryCallingCodes.length &&
    supported.includes(curr.alpha2)
  ) {
    // see here for why we check status is 'assigned'
    // https://github.com/OpenBookPrices/country-data/tree/011dbb6658b0df5a36690af7086baa3e5c20c30c#status-notes
    res[curr.alpha2] = {
      alpha2: curr.alpha2,
      callingCode: curr.countryCallingCodes[0],
      emoji: curr.emoji,
      example: phoneUtil.format(phoneUtil.getExampleNumber(curr.alpha2)),
      name: curr.name,
    }
  }
  return res
}, {})

export const AsYouTypeFormatter = libphonenumber.AsYouTypeFormatter
