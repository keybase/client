// @flow
import * as PropProviders from '../../../stories/prop-providers'
import * as React from 'react'
import CodePage2 from '.'
import {action, storiesOf} from '../../../stories/storybook'
import {qrGenerate} from '../../../constants/login'
import * as Helper from './helper'

const textCode = 'scrub disagree sheriff holiday cabin habit mushroom member four'

const props = (currentDeviceAlreadyProvisioned, currentDeviceType, otherDeviceName, otherDeviceType) => {
  const currentDeviceName = currentDeviceAlreadyProvisioned
    ? currentDeviceType === 'phone'
      ? 'oldPhone6'
      : 'oldMacMini'
    : ''

  const options = Helper.getOptions({
    currentDeviceAlreadyProvisioned,
    currentDeviceName,
    currentDeviceType,
    otherDeviceName,
    otherDeviceType,
    username: currentDeviceAlreadyProvisioned ? 'cnojima123' : '',
  })

  return {
    currentDeviceAlreadyProvisioned,
    currentDeviceType,
    defaultTab: options.defaultTab,
    enterQrCodeInstructions: ``,
    enterTextCodeInputHint: options.enterTextCodeInputHint,
    enterTextCodeInstructions: options.enterTextCodeInstructions,
    isValidLookingCode: value => value.split(' ').length === 12,
    onSubmitTextCode: action('onSubmitTextCode'),
    otherDeviceType,
    validTabs: options.validTabs,
    viewQrCode: qrGenerate(textCode),
    viewQrCodeInstructions: options.viewQrCodeInstructions,
    viewTextCode: textCode,
    viewTextCodeInstructions: options.viewTextCodeInstructions,
  }
}

const load = () => {
  // make it easy to see both sides of the provisioning
  const variants = [
    {current: 'desktop', otherType: 'desktop', provisioned: true},
    {current: 'desktop', otherType: 'desktop', provisioned: false},
    {current: 'phone', otherType: 'phone', provisioned: true},
    {current: 'phone', otherType: 'phone', provisioned: false},
    {current: 'phone', otherType: 'desktop', provisioned: true},
    {current: 'desktop', otherType: 'phone', provisioned: false},
    {current: 'phone', otherType: 'desktop', provisioned: false},
    {current: 'desktop', otherType: 'phone', provisioned: true},
  ]
  variants.forEach(({current, provisioned, otherType}) => {
    let otherName
    switch (otherType) {
      case 'desktop':
        otherName = 'newMacbookPro13'
        break
      case 'phone':
        otherName = 'newiPhoneX'
        break
      case null:
        otherName = ''
        break
    }

    const storyName = `${provisioned ? 'An Existing' : 'A New'} ${current} ${
      provisioned ? ' adding ' : ' added by '
    } ${provisioned ? 'a New' : 'An Existing'} ${otherType}`

    let s = storiesOf(`Register/CodePage2`, module).addDecorator(PropProviders.Common())
    const p = props(provisioned, current, otherName, otherType)
    // We want to snapshot all variants, but also want to ensure the default tab logic works
    const tabs = [null, ...p.validTabs]
    tabs.forEach(
      tab =>
        (s = s.add(`${storyName}:${tab || 'defaultTab'}`, () => (
          <CodePage2 {...p} defaultTab={tab || p.defaultTab} />
        )))
    )
  })
}

export default load
