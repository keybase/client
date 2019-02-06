// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {upperFirst} from 'lodash-es'

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
      ...Styles.transition('transform', 'box-shadow'),
      '&:hover': {
        ...Styles.desktopStyles.boxShadow,
        transform: 'scale(1.005)',
      },
      border: `1px solid ${Styles.globalColors.black_05}`,
      borderRadius: Styles.borderRadius,
      padding: Styles.globalMargins.tiny,
    })
const typeToIcon = {
  computer: 'icon-computer-96',
  'paper key': 'icon-paper-key-96',
  phone: 'icon-phone-96',
}
const DeviceOption = ({onClick, type}) => (
  <Kb.ClickableBox onClick={onClick}>
    <DeviceBox direction="vertical" centerChildren={true} gap="xtiny" gapEnd={true}>
      <Kb.Icon type={typeToIcon[type]} />
      <Kb.Text type="BodySemibold">{upperFirst(type)}</Kb.Text>
    </DeviceBox>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.small,
  },
})

export default Kb.HeaderOrPopup(AddDevice)
