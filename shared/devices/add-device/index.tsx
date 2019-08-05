import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isLargeScreen} from '../../constants/platform'

type Props = {
  highlight?: Array<'computer' | 'phone' | 'paper key'> | null
  onAddComputer: () => void
  onAddPaperKey: () => void
  onAddPhone: () => void
  onCancel: () => void
}

const AddDevice = (props: Props) => (
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
        gap="large"
        style={styles.deviceOptions}
        gapEnd={true}
      >
        <DeviceOption
          onClick={props.onAddComputer}
          type="computer"
          highlight={props.highlight && props.highlight.includes('computer')}
        />
        <DeviceOption
          onClick={props.onAddPhone}
          type="phone"
          highlight={props.highlight && props.highlight.includes('phone')}
        />
        <DeviceOption
          onClick={props.onAddPaperKey}
          type="paper key"
          highlight={props.highlight && props.highlight.includes('paper key')}
        />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ScrollView>
)

const bigIcon = isLargeScreen && Styles.isMobile
const typeToIcon = {
  computer: bigIcon ? 'icon-computer-96' : 'icon-computer-64',
  'paper key': bigIcon ? 'icon-paper-key-96' : 'icon-paper-key-64',
  phone: bigIcon ? 'icon-phone-96' : 'icon-phone-64',
}
const DeviceOption = ({highlight, onClick, type}) => (
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
      <Kb.Icon type={typeToIcon[type]} />
      <Kb.Text type="BodySemibold">
        {type === 'paper key' ? 'Create' : 'Add'} a {type}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate({
  container: { padding: Styles.globalMargins.small },
  deviceOption: {
    ...Styles.transition('background-color'),
    borderColor: Styles.globalColors.black_05,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
    width: Styles.isMobile ? 160 : 140,
  },
  deviceOptionHighlighted: {backgroundColor: Styles.globalColors.blueLighter2},
  deviceOptions: Styles.platformStyles({
    isElectron: { paddingLeft: Styles.globalMargins.large },
    isMobile: { paddingTop: Styles.globalMargins.medium },
  }),
})

export default Kb.HeaderOrPopup(AddDevice)
