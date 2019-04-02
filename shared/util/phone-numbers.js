// @flow
import libphonenumber from 'google-libphonenumber'
import countries from './countries.json'

const countryData = countries.reduce((res, curr) => {
  if (curr.alpha3) {
    res[curr.alpha3] = {callingCode: curr.countryCallingCodes[0], emoji: curr.emoji, name: curr.name}
  }
  return res
}, {})

const util = libphonenumber.PhoneNumberUtil.getInstance()
