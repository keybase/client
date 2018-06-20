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

const howToEnterTextCodeOnExistingDevice = p => (
  <Box2 direction="vertical">
    <Text type="Body">
      • Launch Keybase on <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>
    </Text>
    <Text type="Body">
      • Go to {p.otherDeviceType === 'phone' ? 'Settings > ' : ''}Devices > Add new... and choose{' '}
      <Text type="BodySemiboldItalic">New {p.currentDeviceType}</Text>
    </Text>
    <Text type="Body">
      • Select the <Text type="BodySemiboldItalic">Enter a text code</Text> tab and type this code in:
    </Text>
  </Box2>
)
const howToEnterTextCodeOnNewDevice = p => (
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
      • Select the <Text type="BodySemiboldItalic">Enter a text code</Text> tab and type this code in:
    </Text>
  </Box2>
)

const defaultTab = p => {
  const oppositeTabMap = {
    enterText: 'viewText',
    scanQR: 'viewQR',
    viewQR: 'scanQR',
    viewText: 'enterText',
  }
  const getTabOrOpposite = tabToShowToNew =>
    p.currentDeviceAlreadyProvisioned ? oppositeTabMap[tabToShowToNew] : tabToShowToNew

  // --- New Phone + Existing Phone ---
  if (p.currentDeviceType === 'phone' && p.otherDeviceType === 'phone') {
    return getTabOrOpposite('viewQR')
  }

  // --- New Phone + Existing Desktop ---
  if (p.currentDeviceType === 'phone' && p.otherDeviceType === 'desktop') {
    return getTabOrOpposite('viewQR')
  }

  // --- New Desktop + Existing Desktop ---
  if (p.currentDeviceType === 'desktop' && p.otherDeviceType === 'desktop') {
    return getTabOrOpposite('viewText')
  }

  // --- New Desktop + Existing Phone ---
  if (p.currentDeviceType === 'desktop' && p.otherDeviceType === 'phone') {
    return getTabOrOpposite('scanQR')
  }

  throw new Error('Impossible defaultTab')
}

const validTabs = p => {
  if (p.currentDeviceType === 'desktop' && p.otherDeviceType === 'desktop') {
    return ['viewText', 'enterText']
  } else {
    return ['viewQR', 'scanQR', 'viewText', 'enterText']
  }
}

const viewTextCodeInstructions = p => 'hi'

const enterTextCodeInputHintForNewDevice = p => `Text code from device: '${p.otherDeviceName || 'unknown'}'`
const enterTextCodeInputHintForExistingDevice = p => `Text code from your new ${p.otherDeviceType}`

export const getOptions = (p: CommonParam): Options => {
  return {
    defaultTab: defaultTab(p),
    enterTextCodeInputHint: p.currentDeviceAlreadyProvisioned
      ? enterTextCodeInputHintForNewDevice(p)
      : enterTextCodeInputHintForExistingDevice(p),
    enterTextCodeInstructions: p.currentDeviceAlreadyProvisioned
      ? howToGetTextCodeOnNewDevice(p)
      : howToGetTextCodeOnExistingDevice(p),
    validTabs: validTabs(p),
    viewTextCodeInstructions: viewTextCodeInstructions(p),
  }

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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnExistingDevice(p),
    }
  }
  // Existing phone's perspective
  if (p.currentDeviceAlreadyProvisioned && p.currentDeviceType === 'phone' && p.otherDeviceType === 'phone') {
    return {
      defaultTab: 'viewQR',
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnNewDevice(p),
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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnExistingDevice(p),
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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnNewDevice(p),
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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
      validTabs: ['viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnExistingDevice(p),
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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
      validTabs: ['viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnNewDevice(p),
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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnExistingDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnExistingDevice(p),
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
      enterTextCodeInputHint,
      enterTextCodeInstructions: howToGetTextCodeOnNewDevice(p),
      validTabs: ['viewQR', 'scanQR', 'viewText', 'enterText'],
      viewTextCodeInstructions: howToEnterTextCodeOnNewDevice(p),
    }
  }

  throw new Error('Impossible getOptions')
}
