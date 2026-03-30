import * as S from '@/constants/strings'

let devicename = S.defaultDevicename

export const getSignupDeviceNameDraft = () => devicename

export const setSignupDeviceNameDraft = (nextDevicename: string) => {
  devicename = nextDevicename
}

export const clearSignupDeviceNameDraft = () => {
  devicename = S.defaultDevicename
}
