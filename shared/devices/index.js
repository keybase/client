// @flow
import * as Types from '../constants/types/devices'
import * as React from 'react'
import * as Kb from '../common-adapters'
import DeviceRow from './row/container'
import * as Styles from '../styles'
import {compose} from '../util/container'

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
  hasNewlyRevoked: boolean,
  waiting: boolean,
  title: string,
  ...$Exact<Kb.OverlayParentProps>,
|}

class Devices extends React.PureComponent<Props, State> {
  static defaultProps = {_stateOverride: null}
  state = {revokedExpanded: this.props._stateOverride ? this.props._stateOverride.revokedExpanded : false}

  componentDidMount() {
    this.props.loadDevices()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.hasNewlyRevoked && !prevState.revokedExpanded) {
      this.setState({revokedExpanded: true})
    }
  }

  _toggleExpanded = () => this.setState(p => ({revokedExpanded: !p.revokedExpanded}))

  _renderRow = (index, item) => {
    if (item.type === 'revokedHeader') {
      return (
        <RevokedHeader
          key="revokedHeader"
          expanded={this.state.revokedExpanded}
          onToggleExpanded={this._toggleExpanded}
        />
      )
    } else {
      return <DeviceRow key={item.id} deviceID={item.id} firstItem={index === 0} />
    }
  }

  render() {
    const items = [
      ...this.props.items,
      ...(this.props.items.length ? [{key: 'revokedHeader', type: 'revokedHeader'}] : []),
      ...(this.state.revokedExpanded ? this.props.revokedItems : []),
    ]

    const menuItems = [
      {onClick: this.props.addNewPhone, title: 'New phone'},
      {onClick: this.props.addNewComputer, title: 'New computer'},
      {onClick: this.props.addNewPaperKey, title: 'New paper key'},
    ]

    return (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        <DeviceHeader
          setAttachmentRef={this.props.setAttachmentRef}
          onAddNew={this.props.toggleShowingMenu}
          waiting={this.props.waiting}
        />
        {this.props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
        <Kb.List items={items} renderItem={this._renderRow} />
        <Kb.FloatingMenu
          closeOnSelect={true}
          attachTo={this.props.getAttachmentRef}
          visible={this.props.showingMenu}
          onHidden={this.props.toggleShowingMenu}
          items={menuItems}
          position="bottom center"
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    position: 'relative',
  },
  progress: {
    left: 12,
    position: 'absolute',
    top: Styles.isMobile ? 22 : 14,
    width: 20,
  },
})

const DeviceHeader = ({onAddNew, setAttachmentRef, waiting}) => (
  <Kb.ClickableBox onClick={onAddNew}>
    <Kb.Box2
      direction="horizontal"
      ref={setAttachmentRef}
      gap="xtiny"
      style={headerStyles.container}
      fullWidth={true}
      centerChildren={true}
    >
      <Kb.Icon type="iconfont-new" color={Styles.globalColors.blue} />
      <Kb.Text type="BodyBigLink">Add new...</Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)
const headerStyles = Styles.styleSheetCreate({
  container: {height: Styles.isMobile ? 64 : 48},
})

const RevokedHeader = ({children, onToggleExpanded, expanded}) => (
  <Kb.ClickableBox onClick={onToggleExpanded}>
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        gap="xtiny"
        gapStart={true}
        style={revokedHeaderStyles.textContainer}
      >
        <Kb.Text type="BodySmallSemibold" style={revokedHeaderStyles.text}>
          Revoked devices
        </Kb.Text>
        <Kb.Icon
          type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
          color={Styles.globalColors.black_50}
          fontSize={10}
        />
      </Kb.Box2>
      {expanded && (
        <Kb.Text center={true} type="BodySmallSemibold" style={revokedHeaderStyles.desc}>
          Revoked devices will no longer be able to access your Keybase account.
        </Kb.Text>
      )}
    </Kb.Box2>
  </Kb.ClickableBox>
)
const revokedHeaderStyles = Styles.styleSheetCreate({
  desc: {
    alignSelf: 'center',
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  text: {color: Styles.globalColors.black_50},
  textContainer: {
    alignItems: 'center',
    minHeight: Styles.isMobile ? 32 : 24,
  },
})

export default compose(
  Kb.OverlayParentHOC,
  Kb.HeaderOnMobile
)(Devices)
