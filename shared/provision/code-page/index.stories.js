// @flow
import * as PropProviders from '../../stories/prop-providers'
import * as React from 'react'
import CodePage2 from '.'
import QRScanNotAuthorized from './qr-scan/not-authorized'
import {Box2} from '../../common-adapters'
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
    ? currentDeviceType === 'mobile'
      ? 'oldPhone6'
      : 'oldMacMini'
    : ''
  return {
    currentDeviceAlreadyProvisioned,
    currentDeviceName,
    currentDeviceType,
    onBack: action('onBack'),
    onSubmitTextCode: action('onSubmitTextCode'),
    otherDeviceName,
    otherDeviceType,
    textCode,
  }
}

const load = () => {
  storiesOf(`Provision/CodePage2`, module).add(
    "<Type1> adding Type2 means from that Type1 is provisioning Type2 and we're seeing it from Type1's perspective",
    () => null
  )

  // make it easy to see both sides of the provisioning
  const variants = [
    {current: 'desktop', otherType: 'desktop', provisioned: true},
    {current: 'desktop', otherType: 'desktop', provisioned: false},
    {current: 'mobile', otherType: 'mobile', provisioned: true},
    {current: 'mobile', otherType: 'mobile', provisioned: false},
    {current: 'mobile', otherType: 'desktop', provisioned: true},
    {current: 'desktop', otherType: 'mobile', provisioned: false},
    {current: 'mobile', otherType: 'desktop', provisioned: false},
    {current: 'desktop', otherType: 'mobile', provisioned: true},
  ]
  variants.forEach(({current, provisioned, otherType}) => {
    let otherName
    switch (otherType) {
      case 'desktop':
        otherName = 'newMacbookPro13'
        break
      case 'mobile':
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

    let s = storiesOf(`Provision/CodePage2`, module).addDecorator(PropProviders.CommonProvider())
    const tabs = [null, ...CodePage2._validTabs(current, otherType)]
    tabs.forEach(
      tab =>
        (s = s.add(`${storyName} (tab: ${tab || 'defaultTab'})`, () => (
          <CodePage2 {...derivedProps(provisioned, current, otherName, otherType)} tabOverride={tab} />
        )))
    )
  })

  storiesOf(`Provision/CodePage2`, module).add('QR Scan Not Authorized', () => (
    <Box2 direction="vertical" style={{height: 200, width: 200}}>
      <QRScanNotAuthorized onOpenSettings={action('onOpenSettings')} />
    </Box2>
  ))
}

export default load
