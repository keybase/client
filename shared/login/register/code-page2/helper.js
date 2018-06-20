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

const enterTextCodeInputHintForNewDevice = p => `Text code from device: '${p.otherDeviceName || 'unknown'}'`
const enterTextCodeInputHintForExistingDevice = p => `Text code from your new ${p.otherDeviceType}`
const howToGetTextCodeOnExistingDevice = p => (
  <Box2 direction="vertical">
    <Text type="Body">
      • Launch Keybase on <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>
    </Text>
    <Text type="Body">
      • Go to {p.otherDeviceType === 'phone' ? 'Settings > ' : ''}Devices > Add new... and choose{' '}
      <Text type="BodySemiboldItalic">New {p.currentDeviceType}</Text>
    </Text>
    <Text type="Body">
      • Select the <Text type="BodySemiboldItalic">See a text code</Text> tab and enter that code below
    </Text>
  </Box2>
)

const howToGetTextCodeOnNewDevice = p => (
  <Box2 direction="vertical">
    <Text type="Body">
      • Launch Keybase on your new {p.otherDeviceType} and log in as{' '}
      <Text type="BodySemiboldItalic">{p.username}</Text>
    </Text>
    <Text type="Body">
      • Select a name for your new {p.otherDeviceType} and choose{' '}
      <Text type="BodySemiboldItalic">{p.currentDeviceName}</Text> to provision with
    </Text>
    <Text type="Body">
      • Select the <Text type="BodySemiboldItalic">See a text code</Text> tab and enter that code below
    </Text>
  </Box2>
)

export const getOptions = (p: CommonParam): Options => {
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
      enterTextCodeInputHint: enterTextCodeInputHintForNewDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }
  // Existing phone's perspective
  if (p.currentDeviceAlreadyProvisioned && p.currentDeviceType === 'phone' && p.otherDeviceType === 'phone') {
    return {
      defaultTab: 'viewQR',
      enterTextCodeInputHint: enterTextCodeInputHintForExistingDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
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
      enterTextCodeInputHint: enterTextCodeInputHintForNewDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
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
      enterTextCodeInputHint: enterTextCodeInputHintForExistingDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
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
      enterTextCodeInputHint: enterTextCodeInputHintForNewDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
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
      enterTextCodeInputHint: enterTextCodeInputHintForExistingDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
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
      enterTextCodeInputHint: enterTextCodeInputHintForNewDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
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
      enterTextCodeInputHint: enterTextCodeInputHintForExistingDevice(p),
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
    }
  }

  throw new Error('Impossible getOptions')
}
