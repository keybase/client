// @flow

// Various pieces of text we show when provisioning.  This happens when you're on the new device or when you're on the existing device.
// If you're adding a new device we don't know the name of the other device (otherDevice)

export type DeviceType = 'phone' | 'desktop'
export type Tab = 'viewQR' | 'scanQR' | 'enterText' | 'viewText'

type CommonParam = {
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: DeviceType,
  otherDeviceName: ?string,
  otherDeviceType: DeviceType,
}

export const getEnterTextCodeInputHint = (p: CommonParam) =>
  `Text code from ${p.otherDeviceName ? `device: '${p.otherDeviceName}'` : 'your new device'}`

export const getEnterTextCodeInstructions = (p: CommonParam) => {
  return 'TODO'
  // if (p.currentDeviceAlreadyProvisioned && p.currentDeviceType === 'phone' && p.otherDeviceType === 'phone') {
  // return 'viewQR'
  // }

  // if (p.otherDeviceName && p.otherDeviceType) {
  // switch (p.otherDeviceType) {
  // case 'phone':
  // return `Launch Keybase on ${
  // p.otherDeviceName
  // } and go to Settings > Devices > Add new... and choose New ${p.currentDeviceType}`
  // case 'desktop':
  // return 'TODO'
  // default:
  // [>::
  // declare var ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove: (deviceType: empty) => any
  // ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove(otherDeviceType);
  // */
  // throw new Error('Impossible enterTextCodeInstructions')
  // }
  // } else {
  // return 'TODO'
  // }
}

export const getDefaultMode = (p: CommonParam): Tab => {
  // Matching pairs of experiences

  // New Phone + Existing Phone
  // New phone scans an existing phone's QR code
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'phone' &&
    p.otherDeviceType === 'phone'
  ) {
    return 'scanQR'
  }
  // Other side: Existing phone shows QR code to be scanned
  if (p.currentDeviceAlreadyProvisioned && p.currentDeviceType === 'phone' && p.otherDeviceType === 'phone') {
    return 'viewQR'
  }

  // New Phone + Existing Desktop
  // New phone scans an existing desktop's QR code
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'phone' &&
    p.otherDeviceType === 'desktop'
  ) {
    return 'scanQR'
  }
  // Other side: Existing desktop shows QR code to be scanned
  if (
    p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'phone'
  ) {
    return 'viewQR'
  }

  // New Desktop + Existing Desktop
  // New desktop types code from existing desktop
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'desktop'
  ) {
    return 'enterText'
  }
  // Other side: Existing desktop shows code to be typed
  if (
    p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'desktop'
  ) {
    return 'viewText'
  }

  // New Desktop + Existing Phone
  // New desktop shows QR code to existing phone
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'phone'
  ) {
    return 'viewQR'
  }
  // Other side: Existing phone scans code on new Desktop
  if (
    p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'phone' &&
    p.otherDeviceType === 'desktop'
  ) {
    return 'scanQR'
  }

  throw new Error('Impossible getDefaultMode')
}

export const getValidModes = (p: CommonParam): Array<Tab> => {
  const phoneInvolved = p.currentDeviceType === 'phone' || p.otherDeviceType === 'phone'
  return [...(phoneInvolved ? ['viewQR'] : []), ...(phoneInvolved ? ['scanQR'] : []), 'viewText', 'enterText']
}
