import * as React from 'react'
import * as Sb from '../../stories/storybook'
import CodePage2 from '.'
import QRNotAuthorized from '../../common-adapters/qr-not-authorized'
import {Box2} from '../../common-adapters'
import * as Constants from '../../constants/provision'
import * as DevicesConstants from '../../constants/devices'
const textCodeShort = 'scrub disagree sheriff holiday cabin habit mushroom member'
const textCodeLong = textCodeShort + ' four'
// Not using the container on purpose since i want every variant
const derivedProps = (
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: 'desktop' | 'mobile',
  otherDeviceName: string,
  otherDeviceType: 'desktop' | 'mobile'
) => {
  const currentDeviceName = currentDeviceAlreadyProvisioned
    ? currentDeviceType === 'mobile'
      ? 'Old iPhone 6'
      : 'Old Mac Mini'
    : ''
  return {
    currentDevice: DevicesConstants.makeDevice({deviceNumberOfType: 3, type: currentDeviceType}),
    currentDeviceAlreadyProvisioned,
    currentDeviceName,
    currentDeviceType,
    error: '',
    iconNumber: 1,
    onBack: Sb.action('onBack'),
    onClose: Sb.action('onClose'),
    onSubmitTextCode: Sb.action('onSubmitTextCode'),
    otherDevice: {...Constants.makeDevice(), name: otherDeviceName, type: otherDeviceType},
    setHeaderBackgroundColor: Sb.action('setHeaderBackgroundColor'),
    textCode: otherDeviceType === 'mobile' || currentDeviceType === 'mobile' ? textCodeLong : textCodeShort,
    waiting: false,
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
    "<Type1> adding Type2 means from that Type1 is provisioning Type2. <..> means we're seeing it from Type1's perspective.",
    () => null
  )

  // make it easy to see both sides of the provisioning
  const variants: Array<{
    current: 'desktop' | 'mobile'
    otherType: 'desktop' | 'mobile'
    provisioned: boolean
  }> = [
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
        otherName = 'New Macbook Pro 13'
        break
      case 'mobile':
        otherName = 'New iPhone X'
        break
      default:
        otherName = ''
    }

    // We're looking at this from current's perspective
    const currentTypeName = `<${current}>`
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
      tabOverride="enterText"
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
      <CodePage2 {...derivedProps(true, 'mobile', 'mobile', 'mobile')} tabOverride="QR" />
    ))
}

export default load
