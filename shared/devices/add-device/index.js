// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isLargeScreen} from '../../constants/platform'

type Props = {|
  onAddComputer: () => void,
  onAddPaperKey: () => void,
  onAddPhone: () => void,
  onCancel: () => void,
  title: string,
|}

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
        gapStart={true}
        gapEnd={true}
      >
        <DeviceOption onClick={props.onAddComputer} type="computer" />
        <DeviceOption onClick={props.onAddPhone} type="phone" />
        <DeviceOption onClick={props.onAddPaperKey} type="paper key" />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ScrollView>
)

const DeviceBox = Styles.isMobile
  ? Kb.Box2
  : Styles.styled(Kb.Box2)({
      ...Styles.transition('background-color'),
      '&:hover': {
        backgroundColor: Styles.globalColors.blue4,
      },
      border: `1px solid ${Styles.globalColors.black_05}`,
      borderRadius: Styles.borderRadius,
      padding: Styles.globalMargins.tiny,
      width: 140,
    })
const bigIcon = isLargeScreen && Styles.isMobile
const typeToIcon = {
  computer: bigIcon ? `icon-computer-96` : `icon-computer-64`,
  'paper key': bigIcon ? `icon-paper-key-96` : `icon-paper-key-64`,
  phone: bigIcon ? `icon-phone-96` : `icon-phone-64`,
}
const DeviceOption = ({onClick, type}) => (
  <Kb.ClickableBox onClick={onClick}>
    <DeviceBox direction="vertical" centerChildren={true} gap="xtiny" gapEnd={true}>
      <Kb.Icon type={typeToIcon[type]} />
      <Kb.Text type="BodySemibold">
        {type === 'paper key' ? 'Create' : 'Add'} a {type}
      </Kb.Text>
    </DeviceBox>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.small,
  },
})

export default Kb.HeaderOrPopup(AddDevice)
