import * as C from '@/constants'
import * as Devices from '@/stores/devices'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useProvisionState} from '@/stores/provision'

type OwnProps = {
  highlight?: Array<'computer' | 'phone' | 'paper key'>
}
const noHighlight = new Array<'computer' | 'phone' | 'paper key'>()

export default function AddDevice(ownProps: OwnProps) {
  const highlight = ownProps.highlight ?? noHighlight
  const iconNumbers = Devices.useNextDeviceIconNumber()
  const addNewDevice = useProvisionState(s => s.dispatch.addNewDevice)

  const onAddComputer = React.useCallback(() => {
    addNewDevice('desktop')
  }, [addNewDevice])

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  // don't allow mutliple clicks to add paper key
  const canAddPaperKeyRef = React.useRef(true)
  const onAddPaperKey = React.useCallback(() => {
    if (!canAddPaperKeyRef.current) return
    canAddPaperKeyRef.current = false
    navigateAppend('devicePaperKey')
    setTimeout(() => {
      canAddPaperKeyRef.current = true
    }, 1000)
  }, [navigateAppend])

  const onAddPhone = React.useCallback(() => {
    addNewDevice('mobile')
  }, [addNewDevice])
  const cancel = useProvisionState(s => s.dispatch.dynamic.cancel)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = React.useCallback(() => {
    cancel?.()
    navigateUp()
  }, [cancel, navigateUp])

  return (
    <Kb.PopupWrapper onCancel={onCancel}>
      <Kb.ScrollView alwaysBounceVertical={false}>
        <Kb.Box2
          direction="vertical"
          gap="medium"
          alignItems="center"
          style={styles.container}
          gapStart={true}
          gapEnd={true}
        >
          <Kb.Box2 direction="vertical" gap="tiny" alignItems="center">
            {!Kb.Styles.isMobile && <Kb.Text type="Header">Add a device</Kb.Text>}
            <Kb.Text type="Body" center={true}>
              Protect your account by having more devices and paper keys.
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction={Kb.Styles.isMobile ? 'vertical' : 'horizontal'}
            gap="mediumLarge"
            style={styles.deviceOptions}
            gapEnd={true}
          >
            <DeviceOption
              iconNumber={iconNumbers.desktop}
              onClick={onAddComputer}
              type="computer"
              highlight={highlight.includes('computer')}
            />
            <DeviceOption
              iconNumber={iconNumbers.mobile}
              onClick={onAddPhone}
              type="phone"
              highlight={highlight.includes('phone')}
            />
            <DeviceOption
              onClick={onAddPaperKey}
              type="paper key"
              highlight={highlight.includes('paper key')}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.PopupWrapper>
  )
}

type DeviceOptionProps = {
  highlight?: boolean
  iconNumber?: number
  onClick: () => void
  type: 'computer' | 'paper key' | 'phone'
}
const bigIcon = C.isLargeScreen && Kb.Styles.isMobile
const getIconType = (deviceType: DeviceOptionProps['type'], iconNumber?: number) => {
  let iconType: string
  const size = bigIcon ? 96 : 64
  switch (deviceType) {
    case 'computer':
      iconType = iconNumber ? `icon-computer-background-${iconNumber}-${size}` : `icon-computer-${size}`
      break
    case 'paper key':
      iconType = `icon-paper-key-${size}`
      break
    case 'phone':
      iconType = iconNumber ? `icon-phone-background-${iconNumber}-${size}` : `icon-phone-${size}`
      break
  }
  if (Kb.isValidIconType(iconType)) {
    return iconType
  }
  return bigIcon ? 'icon-computer-96' : 'icon-computer-64'
}
const DeviceOption = ({highlight, iconNumber, onClick, type}: DeviceOptionProps) => (
  <Kb.ClickableBox onClick={onClick}>
    <Kb.Box2
      className="hover_background_color_blueLighter2"
      style={Kb.Styles.collapseStyles([
        styles.deviceOption,
        Kb.Styles.isMobile && highlight && styles.deviceOptionHighlighted,
      ])}
      direction="vertical"
      centerChildren={true}
      gap="xtiny"
      gapEnd={!Kb.Styles.isMobile}
    >
      <Kb.Icon type={getIconType(type, iconNumber)} />
      <Kb.Text type="BodySemibold">
        {type === 'paper key' ? 'Create' : 'Add'} a {type === 'phone' ? 'phone or tablet' : type}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {padding: Kb.Styles.globalMargins.small},
  deviceOption: Kb.Styles.platformStyles({
    common: {
      borderColor: Kb.Styles.globalColors.black_05,
      borderRadius: Kb.Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      padding: Kb.Styles.globalMargins.tiny,
      width: Kb.Styles.isMobile ? 192 : 168,
    },
    isElectron: {
      ...Kb.Styles.transition('background-color'),
    },
  }),
  deviceOptionHighlighted: {backgroundColor: Kb.Styles.globalColors.blueLighter2},
  deviceOptions: Kb.Styles.platformStyles({
    isElectron: {paddingLeft: Kb.Styles.globalMargins.large},
    isMobile: {paddingTop: Kb.Styles.globalMargins.medium},
  }),
}))
