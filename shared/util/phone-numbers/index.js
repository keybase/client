// @flow
import libphonenumber from 'google-libphonenumber'
import countries from './countries.json'

const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance()
const supported = phoneUtil.getSupportedRegions()

export const countryData = countries.reduce((res, curr) => {
  if (curr.alpha2 && curr.countryCallingCodes.length && supported.includes(curr.alpha2)) {
    res[curr.alpha2] = {
      alpha2: curr.alpha2,
      callingCode: curr.countryCallingCodes[0],
      emoji: curr.emoji,
      example: phoneUtil.getExampleNumber(curr.alpa2),
      name: curr.name,
    }
  }
  return res
}, {})

export const AsYouTypeFormatter = libphonenumber.AsYouTypeFormatter
