// @flow
import * as React from 'react'
import {Text, Box2} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

// Various pieces of text we show when provisioning.  This happens when you're on the new device or when you're on the existing device.
// If you're adding a new device we don't know the name of the other device (otherDevice)

export type DeviceType = 'phone' | 'desktop'
export type Tab = 'viewQR' | 'scanQR' | 'enterText' | 'viewText'

type CommonParam = {
  username: string,
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: DeviceType,
  currentDeviceName: string,
  otherDeviceName: string,
  otherDeviceType: DeviceType,
}

type Options = {
  defaultTab: Tab,
  validTabs: Array<Tab>,
  enterTextCodeInputHint: string,
  enterTextCodeInstructions: React.Node,
}

// export const getEnterTextCodeInstructions = (p: CommonParam) => {
// return 'TODO'
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
// }

export const getOptions = (p: CommonParam): Options => {
  const enterTextCodeInputHintForNamedDevice = p.otherDeviceName
    ? `Text code from device: '${p.otherDeviceName}'`
    : ''
  const enterTextCodeInputHintForPhone = 'Text code from your new phone'
  const enterTextCodeInputHintForDesktop = 'Text code from your new desktop'

  // Matching pairs of experiences

  // --- New Phone + Existing Phone ---
  // New phone's perspective
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'phone' &&
    p.otherDeviceType === 'phone'
  ) {
    return {
      defaultTab: 'scanQR',
      enterTextCodeInputHint: enterTextCodeInputHintForNamedDevice,
      enterTextCodeInstructions: (
        <Box2 direction="vertical">
          <Text type="Body">
            • Launch Keybase on <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>
          </Text>
          <Text type="Body">
            • Go to Settings > Devices > Add new... and choose{' '}
            <Text type="BodySemiboldItalic">New {p.currentDeviceType}</Text>
          </Text>
          <Text type="Body">
            • Select the <Text type="BodySemiboldItalic">See a text code</Text> tab and enter that code below
          </Text>
        </Box2>
      ),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }
  // Existing phone's perspective
  if (p.currentDeviceAlreadyProvisioned && p.currentDeviceType === 'phone' && p.otherDeviceType === 'phone') {
    return {
      defaultTab: 'viewQR',
      enterTextCodeInputHint: enterTextCodeInputHintForPhone,
      enterTextCodeInstructions: (
        <Box2 direction="vertical">
          <Text type="Body">
            • Launch Keybase on your new phone and log in as{' '}
            <Text type="BodySemiboldItalic">{p.username}</Text>
          </Text>
          <Text type="Body">
            • Select a name for your new phone and choose{' '}
            <Text type="BodySemiboldItalic">{p.currentDeviceName}</Text> to provision with
          </Text>
          <Text type="Body">
            • Select the <Text type="BodySemiboldItalic">See a text code</Text> tab and enter that code below
          </Text>
        </Box2>
      ),

      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }

  // --- New Phone + Existing Desktop ---
  // New phone's perspective
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'phone' &&
    p.otherDeviceType === 'desktop'
  ) {
    return {
      defaultTab: 'scanQR',
      enterTextCodeInputHint: enterTextCodeInputHintForNamedDevice,
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }
  // Existing desktop's perspective
  if (
    p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'phone'
  ) {
    return {
      defaultTab: 'viewQR',
      enterTextCodeInputHint: enterTextCodeInputHintForPhone,
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }

  // --- New Desktop + Existing Desktop ---
  // New desktop's perspective
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'desktop'
  ) {
    return {
      defaultTab: 'enterText',
      enterTextCodeInputHint: enterTextCodeInputHintForNamedDevice,
      // enterTextCodeInstructions: '',
      validTabs: ['viewText', 'enterText'],
    }
  }
  // Existing desktop's perspective
  if (
    p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'desktop'
  ) {
    return {
      defaultTab: 'viewText',
      enterTextCodeInputHint: enterTextCodeInputHintForDesktop,
      // enterTextCodeInstructions: '',
      validTabs: ['viewText', 'enterText'],
    }
  }

  // --- New Desktop + Existing Phone ---
  // New desktop's perspective
  if (
    !p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'desktop' &&
    p.otherDeviceType === 'phone'
  ) {
    return {
      defaultTab: 'viewQR',
      enterTextCodeInputHint: enterTextCodeInputHintForNamedDevice,
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }
  // Existing phone's perspective
  if (
    p.currentDeviceAlreadyProvisioned &&
    p.currentDeviceType === 'phone' &&
    p.otherDeviceType === 'desktop'
  ) {
    return {
      defaultTab: 'scanQR',
      enterTextCodeInputHint: enterTextCodeInputHintForDesktop,
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }

  throw new Error('Impossible getOptions')
}
