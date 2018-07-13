// @flow
import * as PropProviders from '../../stories/prop-providers'
import * as React from 'react'
import CodePage2 from '.'
import {action, storiesOf} from '../../stories/storybook'

const textCode = 'scrub disagree sheriff holiday cabin habit mushroom member four'
// Not using the container on purpose since i want every variant
const derivedProps = (
  currentDeviceAlreadyProvisioned,
  currentDeviceType,
  otherDeviceName,
  otherDeviceType
) => {
  const currentDeviceName = currentDeviceAlreadyProvisioned
    ? currentDeviceType === 'phone'
      ? 'oldPhone6'
      : 'oldMacMini'
    : ''
  return {
    currentDeviceAlreadyProvisioned,
    currentDeviceName,
    currentDeviceType,
    onSubmitTextCode: action('onSubmitTextCode'),
    otherDeviceName,
    otherDeviceType,
    textCode,
    username: currentDeviceAlreadyProvisioned ? 'cnojima123' : '',
  }
}

const load = () => {
  storiesOf(`Register/CodePage2`, module).add(
    "<Type1> adding Type2 means from that Type1 is provisioning Type2 and we're seeing it from Type1's perspective",
    () => null
  )

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
      default:
        otherName = ''
    }

    // We're looking at this from current's perspective
    const currentTypeName = `<${current}>`
    const n1 = provisioned ? currentTypeName : otherType
    const n2 = provisioned ? otherType : currentTypeName
    const storyName = `${n1} adding ${n2}`

    let s = storiesOf(`Register/CodePage2`, module).addDecorator(PropProviders.CommonProvider())
    const tabs = [null, ...CodePage2._validTabs(current, otherType)]
    tabs.forEach(
      tab =>
        (s = s.add(`${storyName} (tab: ${tab || 'defaultTab'})`, () => (
          <CodePage2 {...derivedProps(provisioned, current, otherName, otherType)} tabOverride={tab} />
        )))
    )
  })
}

export default load
