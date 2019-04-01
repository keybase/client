// @flow
import * as Types from '../constants/types/devices'
import * as React from 'react'
import * as Kb from '../common-adapters'
import DeviceRow from './row/container'
import * as Styles from '../styles'

type Item =
  | {key: string, id: Types.DeviceID, type: 'device'}
  | {key: string, type: 'revokedHeader'}
  | {key: string, type: 'revokedNote'}

type State = {
  revokedExpanded: boolean,
}

type Props = {|
  // Only used by storybook
  _stateOverride: ?State,
  items: Array<Item>,
  loadDevices: () => void,
  onAddDevice: (highlight?: Array<'computer' | 'phone' | 'paper key'>) => void,
  onBack: () => void,
  revokedItems: Array<Item>,
  showPaperKeyNudge: boolean,
  hasNewlyRevoked: boolean,
  waiting: boolean,
  title: string,
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
    } else if (item.type === 'revokedNote') {
      return (
        <Kb.Text center={true} type="BodySmallSemibold" style={styles.revokedNote}>
          Revoked devices will no longer be able to access your Keybase account.
        </Kb.Text>
      )
    } else {
      return <DeviceRow key={item.id} deviceID={item.id} firstItem={index === 0} />
    }
  }

  render() {
    const items = [
      ...this.props.items,
      ...(this.props.items.length ? [{key: 'revokedHeader', type: 'revokedHeader'}] : []),
      ...(this.state.revokedExpanded
        ? [{key: 'revokedNote', type: 'revokedNote'}, ...this.props.revokedItems]
        : []),
    ]

    return (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        <DeviceHeader onAddNew={() => this.props.onAddDevice()} waiting={this.props.waiting} />
        {this.props.showPaperKeyNudge && (
          <PaperKeyNudge onAddDevice={() => this.props.onAddDevice(['paper key'])} />
        )}
        {this.props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
        <Kb.List bounces={false} items={items} renderItem={this._renderRow} />
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
  revokedNote: {
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.small, 0),
    width: '100%',
  },
})

const DeviceHeader = ({onAddNew, waiting}) => (
  <Kb.ClickableBox onClick={onAddNew} style={headerStyles.container}>
    <Kb.Button type="Primary" label="Add a device or paper key">
      <Kb.Icon
        type="iconfont-new"
        color={Styles.globalColors.white}
        style={Kb.iconCastPlatformStyles(headerStyles.icon)}
      />
    </Kb.Button>
  </Kb.ClickableBox>
)
const headerStyles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    height: Styles.isMobile ? 64 : 48,
    justifyContent: 'center',
  },
  icon: {
    alignSelf: 'center',
    marginRight: Styles.globalMargins.tiny,
  },
})

const RevokedHeader = ({children, onToggleExpanded, expanded}) => (
  <Kb.SectionDivider collapsed={!expanded} onToggleCollapsed={onToggleExpanded} label="Revoked devices" />
)

const PaperKeyNudge = ({onAddDevice}) => (
  <Kb.ClickableBox onClick={onAddDevice}>
    <Kb.Box2 direction="horizontal" style={paperKeyNudgeStyles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="xsmall" alignItems="center" style={paperKeyNudgeStyles.border}>
        <Kb.Icon type={Styles.isMobile ? 'icon-onboarding-paper-key-48' : 'icon-onboarding-paper-key-32'} />
        <Kb.Box2 direction="vertical" style={paperKeyNudgeStyles.flexOne}>
          <Kb.Text type="BodySemibold">Create a paper key</Kb.Text>
          <Kb.Text type={Styles.isMobile ? 'BodySmall' : 'Body'} style={paperKeyNudgeStyles.desc}>
            A paper key can be used to access your account in case you lose all your devices. Keep one in a
            safe place (like a wallet) to keep your data safe.
          </Kb.Text>
        </Kb.Box2>
        {!Styles.isMobile && <Kb.Text type="BodyBigLink">Create a paper key</Kb.Text>}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)
const paperKeyNudgeStyles = Styles.styleSheetCreate({
  border: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.black_05,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      flex: 1,
    },
    isElectron: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
    },
  }),
  container: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.small,
      paddingTop: 0,
    },
    isMobile: {
      padding: Styles.globalMargins.tiny,
    },
  }),
  desc: Styles.platformStyles({
    isElectron: {
      maxWidth: 450,
    },
  }),
  flexOne: {flex: 1},
})

export default Kb.HeaderOnMobile(Devices)
