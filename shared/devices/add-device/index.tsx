import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isLargeScreen} from '../../constants/platform'
import {useSafeCallback} from '../../util/container'

type Props = {
  highlight?: Array<'computer' | 'phone' | 'paper key'>
  iconNumbers: {desktop: number; mobile: number}
  onAddComputer: () => void
  onAddPaperKey: () => void
  onAddPhone: () => void
  onCancel: () => void
}

const AddDevice = (props: Props) => {
  const onlyOnce = true
  const onAddComputer = useSafeCallback(props.onAddComputer, {onlyOnce})
  const onAddPhone = useSafeCallback(props.onAddPhone, {onlyOnce})
  const onAddPaperKey = useSafeCallback(props.onAddPaperKey, {onlyOnce})
  return (
    <Kb.PopupWrapper onCancel={props.onCancel}>
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
            {!Styles.isMobile && <Kb.Text type="Header">Add a device</Kb.Text>}
            <Kb.Text type="Body" center={true}>
              Protect your account by having more devices and paper keys.
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction={Styles.isMobile ? 'vertical' : 'horizontal'}
            gap="mediumLarge"
            style={styles.deviceOptions}
            gapEnd={true}
          >
            <DeviceOption
              iconNumber={props.iconNumbers.desktop}
              onClick={onAddComputer}
              type="computer"
              highlight={props.highlight && props.highlight.includes('computer')}
            />
            <DeviceOption
              iconNumber={props.iconNumbers.mobile}
              onClick={onAddPhone}
              type="phone"
              highlight={props.highlight && props.highlight.includes('phone')}
            />
            <DeviceOption
              onClick={onAddPaperKey}
              type="paper key"
              highlight={props.highlight && props.highlight.includes('paper key')}
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
const bigIcon = isLargeScreen && Styles.isMobile
const getIconType = (deviceType: DeviceOptionProps['type'], iconNumber?: number) => {
  let iconType
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
      style={Styles.collapseStyles([
        styles.deviceOption,
        Styles.isMobile && highlight && styles.deviceOptionHighlighted,
      ])}
      direction="vertical"
      centerChildren={true}
      gap="xtiny"
      gapEnd={!Styles.isMobile}
    >
      <Kb.Icon type={getIconType(type, iconNumber)} />
      <Kb.Text type="BodySemibold">
        {type === 'paper key' ? 'Create' : 'Add'} a {type === 'phone' ? 'phone or tablet' : type}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {padding: Styles.globalMargins.small},
  deviceOption: {
    ...Styles.transition('background-color'),
    borderColor: Styles.globalColors.black_05,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
    width: Styles.isMobile ? 192 : 168,
  },
  deviceOptionHighlighted: {backgroundColor: Styles.globalColors.blueLighter2},
  deviceOptions: Styles.platformStyles({
    isElectron: {paddingLeft: Styles.globalMargins.large},
    isMobile: {paddingTop: Styles.globalMargins.medium},
  }),
}))

export default AddDevice
