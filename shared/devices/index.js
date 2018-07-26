// @flow
import * as Types from '../constants/types/devices'
import * as React from 'react'
import {
  Box2,
  Box,
  Text,
  List,
  Icon,
  ClickableBox,
  ProgressIndicator,
  HeaderOnMobile,
  iconCastPlatformStyles,
} from '../common-adapters'
import FloatingMenu, {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../common-adapters/floating-menu'
import {RowConnector} from './row'
import {
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../styles'

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
      <DeviceRow key={item.id} deviceID={item.id} />
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

const DeviceHeader = ({onAddNew, setAttachmentRef, waiting}) => (
  <ClickableBox onClick={onAddNew}>
    <Box ref={setAttachmentRef} style={styles.rowNoBorder}>
      {waiting && <ProgressIndicator style={styles.progress} />}
      <Icon type="iconfont-new" color={globalColors.blue} />
      <Text type="BodyBigLink" style={styles.addNew}>
        Add new...
      </Text>
    </Box>
  </ClickableBox>
)

const RevokedHeader = ({children, onToggleExpanded, expanded}) => (
  <Box>
    <ClickableBox onClick={onToggleExpanded}>
      <Box style={styles.rowRevoked}>
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
          Revoked devices
        </Text>
        <Icon
          type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
          style={iconCastPlatformStyles(styles.caret)}
          color={globalColors.black_60}
          fontSize={10}
        />
      </Box>
    </ClickableBox>
    {expanded && (
      <Box style={styles.description}>
        <Text type="BodySmallSemibold" style={styles.descriptionText}>
          Revoked devices will no longer be able to access your Keybase account.
        </Text>
      </Box>
    )}
  </Box>
)

const DeviceRow = RowConnector(({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <ClickableBox onClick={showExistingDevicePage} style={styles.row}>
    <Box key={name} style={styles.rowBox}>
      <Icon type={icon} style={iconCastPlatformStyles(isRevoked ? styles.iconRevoked : icon)} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-start'}}>
        <Text style={isRevoked ? styles.textRevoked : styles.text} type="BodySemiboldItalic">
          {name}
        </Text>
        {isCurrentDevice && <Text type="BodySmall">Current device</Text>}
      </Box>
    </Box>
  </ClickableBox>
))

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const styles = styleSheetCreate({
  addNew: {
    padding: globalMargins.xtiny,
  },
  caret: {padding: 5},
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
  icon: {marginRight: 16},
  iconRevoke: {marginRight: 16, opacity: 0.2},
  progress: {
    left: 12,
    position: 'absolute',
    top: isMobile ? 22 : 14,
    width: 20,
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
  text: {flex: 0},
  textRevoked: platformStyles({
    common: {
      color: globalColors.black_40,
      flex: 0,
      textDecorationLine: 'line-through',
      textDecorationStyle: 'solid',
    },
    isElectron: {
      fontStyle: 'italic',
    },
  }),
})

export default HeaderOnMobile(FloatingMenuParentHOC(Devices))
