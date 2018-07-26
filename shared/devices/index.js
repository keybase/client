// @flow
import * as Types from '../constants/types/devices'
import * as React from 'react'
import * as Common from '../common-adapters'
import FloatingMenu, {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../common-adapters/floating-menu'
import DeviceRow from './row/container'
import * as Styles from '../styles'

// TODO remove
const {Box2, Text, List, Icon, ClickableBox, ProgressIndicator, HeaderOnMobile} = Common

// TODO remove
const {globalStyles, globalColors, globalMargins, isMobile, styleSheetCreate} = Styles

// TODO use list-item2

type Item = {key: string, id: Types.DeviceID, type: 'device'} | {key: string, type: 'revokedHeader'}

type State = {
  revokedExpanded: boolean,
}

type Props = {|
  // Only used by storybook
  _stateOverride: ?State,
  addNewComputer: () => void,
  addNewPaperKey: () => void,
  addNewPhone: () => void,
  items: Array<Item>,
  loadDevices: () => void,
  onBack: () => void,
  revokedItems: Array<Item>,
  waiting: boolean,
|}

class Devices extends React.PureComponent<Props & FloatingMenuParentProps, State> {
  static defaultProps = {_stateOverride: null}
  state = {revokedExpanded: this.props._stateOverride ? this.props._stateOverride.revokedExpanded : false}

  componentDidMount() {
    this.props.loadDevices()
  }

  _toggleExpanded = () => this.setState(p => ({revokedExpanded: !p.revokedExpanded}))

  _renderRow = (index, item) =>
    item.type === 'revokedHeader' ? (
      <RevokedHeader
        key="revokedHeader"
        expanded={this.state.revokedExpanded}
        onToggleExpanded={this._toggleExpanded}
      />
    ) : (
      <DeviceRow key={item.id} deviceID={item.id} firstItem={index === 0} />
    )

  render() {
    const items = [
      ...this.props.items,
      {key: 'revokedHeader', type: 'revokedHeader'},
      ...(this.state.revokedExpanded ? this.props.revokedItems : []),
    ]

    const menuItems = [
      {onClick: this.props.addNewPhone, title: 'New phone'},
      {onClick: this.props.addNewComputer, title: 'New computer'},
      {onClick: this.props.addNewPaperKey, title: 'New paper key'},
    ]

    return (
      <Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <DeviceHeader
          setAttachmentRef={this.props.setAttachmentRef}
          onAddNew={this.props.toggleShowingMenu}
          waiting={this.props.waiting}
        />
        {this.props.waiting && <ProgressIndicator style={styles2.progress} />}
        <List items={items} renderItem={this._renderRow} />
        <FloatingMenu
          attachTo={this.props.attachmentRef}
          visible={this.props.showingMenu}
          onHidden={this.props.toggleShowingMenu}
          items={menuItems}
          position="bottom center"
        />
      </Box2>
    )
  }
}
const styles2 = styleSheetCreate({
  progress: {
    left: 12,
    position: 'absolute',
    top: isMobile ? 22 : 14,
    width: 20,
  },
})

const DeviceHeader = ({onAddNew, setAttachmentRef, waiting}) => (
  <ClickableBox onClick={onAddNew}>
    <Box2
      direction="horizontal"
      ref={setAttachmentRef}
      gap="xtiny"
      style={headerStyles.container}
      fullWidth={true}
      centerChildren={true}
    >
      <Icon type="iconfont-new" color={globalColors.blue} />
      <Text type="BodyBigLink">Add new...</Text>
    </Box2>
  </ClickableBox>
)
const headerStyles = styleSheetCreate({
  container: {height: isMobile ? 64 : 48},
})

const RevokedHeader = ({children, onToggleExpanded, expanded}) => (
  <ClickableBox onClick={onToggleExpanded}>
    <Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Box2
        direction="horizontal"
        fullWidth={true}
        gap="xtiny"
        gapStart={true}
        style={revokedHeaderStyles.textContainer}
      >
        <Text type="BodySmallSemibold" style={revokedHeaderStyles.text}>
          Revoked devices
        </Text>
        <Icon
          type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
          color={globalColors.black_60}
          fontSize={10}
        />
      </Box2>
      {expanded && (
        <Text type="BodySmallSemibold" style={revokedHeaderStyles.desc}>
          Revoked devices will no longer be able to access your Keybase account.
        </Text>
      )}
    </Box2>
  </ClickableBox>
)
const revokedHeaderStyles = styleSheetCreate({
  desc: {
    alignSelf: 'center',
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    textAlign: 'center',
  },
  text: {color: globalColors.black_60},
  textContainer: {alignItems: 'center'},
})

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

// TODO remove
const styles = styleSheetCreate({
  addNew: {
    padding: globalMargins.xtiny,
  },
  description: {
    ...globalStyles.flexBoxColumn,
    ...stylesCommonCore,
    alignItems: 'center',
    paddingLeft: 32,
    paddingRight: 32,
  },
  descriptionText: {
    color: globalColors.black_40,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
    textAlign: 'center',
  },
  row: {
    ...globalStyles.flexBoxRow,
    ...stylesCommonCore,
    minHeight: isMobile ? 64 : 48,
    padding: 8,
  },
  rowBox: {...globalStyles.flexBoxRow, alignItems: 'center', flex: 1},
  rowNoBorder: {
    ...globalStyles.flexBoxRow,
    ...stylesCommonCore,
    borderBottomWidth: 0,
    minHeight: isMobile ? 64 : 48,
    padding: 8,
  },
  rowRevoked: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 38,
    paddingLeft: 8,
  },
})

export default HeaderOnMobile(FloatingMenuParentHOC(Devices))
