import * as React from 'react'
import * as Sb from '../../stories/storybook'
import CodePage2 from '.'
import {Box2, QRNotAuthorized} from '../../common-adapters'

const textCodeShort = 'scrub disagree sheriff holiday cabin habit mushroom member'
const textCodeLong = textCodeShort + ' four'
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
    error: '',
    onBack: Sb.action('onBack'),
    onSubmitTextCode: Sb.action('onSubmitTextCode'),
    otherDeviceName,
    otherDeviceType,
    textCode: otherDeviceType === 'mobile' || currentDeviceType === 'mobile' ? textCodeLong : textCodeShort,
  }
}

const QRScanProps = {
  mountKey: 'key',
  onOpenSettings: Sb.action('onOpenSettings'),
  onSubmitTextCode: Sb.action('onSubmitTextCode'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf(`Provision/CodePage2`, module).add(
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

  let s = Sb.storiesOf(`Provision/CodePage2`, module).addDecorator(
    Sb.createPropProviderWithCommon({
      // @ts-ignore codemode issue
      QRScan: QRScanProps,
      QRScanNotAuthorized: {
        // @ts-ignore codemode issue
        onOpenSettings: Sb.action('onOpenSettings'),
      },
    })
  )
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
    const currentTypeName = `A${current}`
    const n1 = provisioned ? currentTypeName : otherType
    const n2 = provisioned ? otherType : currentTypeName
    const storyName = `${n1} adding ${n2}`

    const tabs = [null, ...CodePage2._validTabs(current, otherType)]
    tabs.forEach(
      tab =>
        (s = s.add(`${storyName} (tab: ${tab || 'defaultTab'})`, () => (
          <CodePage2 {...derivedProps(provisioned, current, otherName, otherType)} tabOverride={tab as any} />
        )))
    )
  })

  s = s.add('EnterText with error', () => (
    <CodePage2
      {...derivedProps(true, 'desktop', 'computer', 'desktop')}
      error="Invalid secret code. Please try again."
      tabOverride={'enterText'}
    />
  ))
  s = s.add('QR Scan Not Authorized', () => (
    <Box2 direction="vertical" style={{height: 200, width: 200}}>
      <QRNotAuthorized />
    </Box2>
  ))

  s = Sb.storiesOf(`Provision/CodePage2`, module)
    .addDecorator(
      Sb.createPropProviderWithCommon({
        // @ts-ignore codemode issue
        QRScan: {...QRScanProps, waiting: true},
      })
    )
    .add('QR Scan waiting', () => (
      <CodePage2 {...derivedProps(true, 'mobile', 'mobile', 'mobile')} tabOverride={'QR'} />
    ))
}

export default load
