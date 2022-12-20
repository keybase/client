import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import type {Props} from '.'

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

class ThresholdDropdown extends React.PureComponent<
  Props,
  {notificationThreshold: number; visible: boolean}
> {
  state = {
    notificationThreshold: this.props.spaceAvailableNotificationThreshold,
    visible: false,
  }
  _hide = () => this.setState({visible: false})
  _done = () => {
    this.props.onSetSyncNotificationThreshold(this.state.notificationThreshold)
    this.setState({visible: false})
  }
  _select = selectedVal => this.setState({notificationThreshold: selectedVal})
  _show = () => this.setState({visible: true})
  _toggleShowingMenu = () => this.setState(s => ({visible: !s.visible}))
  render() {
    return (
      <>
        <Kb.DropdownButton
          disabled={!this.props.spaceAvailableNotificationThreshold}
          selected={
            <Kb.Text type="Body" style={styles.selectedText}>
              {this.props.humanizedNotificationThreshold}
            </Kb.Text>
          }
          toggleOpen={this._toggleShowingMenu}
        />
        <Kb.FloatingPicker
          items={this.props.allowedThresholds}
          visible={this.state.visible}
          selectedValue={this.state.notificationThreshold}
          promptString="Pick a threshold"
          prompt={
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" centerChildren={true}>
              <Kb.Text type="BodySmallSemibold">Pick a threshold</Kb.Text>
            </Kb.Box2>
          }
          onCancel={this._hide}
          onHidden={this._hide}
          onDone={this._done}
          onSelect={this._select}
        />
      </>
    )
  }
}

const Files = (props: Props) => {
  const syncOnCellular = Container.useSelector(state => state.fs.settings.syncOnCellular)
  const toggleSyncOnCellular = () => {
    RPCTypes.SimpleFSSimpleFSSetSyncOnCellularRpcPromise(
      {syncOnCellular: !syncOnCellular},
      Constants.setSyncOnCellularWaitingKey
    )
      .then(() => {})
      .catch(() => {})
  }
  const waitingToggleSyncOnCellular = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.setSyncOnCellularWaitingKey)
  )
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      alignItems={Styles.isTablet ? 'flex-start' : 'center'}
      gap="small"
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.syncContent} gap="tiny">
        <Kb.Text type="Header">Sync</Kb.Text>
        <Kb.Switch
          onClick={
            props.spaceAvailableNotificationThreshold === 0
              ? props.onEnableSyncNotifications
              : props.onDisableSyncNotifications
          }
          label="Warn when low on storage space"
          on={props.spaceAvailableNotificationThreshold !== 0}
          disabled={props.areSettingsLoading}
          gapSize={Styles.globalMargins.small}
          style={styles.switch}
        />
        {!!props.spaceAvailableNotificationThreshold && (
          <Kb.Text type="BodySmallSemibold">Threshold:</Kb.Text>
        )}
        {!!props.spaceAvailableNotificationThreshold && <ThresholdDropdown {...props} />}
        <Kb.Switch
          on={syncOnCellular}
          onClick={toggleSyncOnCellular}
          disabled={waitingToggleSyncOnCellular}
          label="Sync files over mobile network"
          labelSubtitle="Syncing over Wi-Fi is always on"
          gapSize={Styles.globalMargins.small}
          style={styles.switch}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

Files.navigationOptions = {
  header: undefined,
  title: 'Files',
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      selectedText: {
        paddingLeft: Styles.globalMargins.xsmall,
        width: '100%',
      },
      switch: {
        marginTop: Styles.globalMargins.small,
      },
      syncContent: Styles.platformStyles({
        common: {
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          paddingTop: Styles.globalMargins.medium,
        },
        isTablet: {
          maxWidth: 410,
        },
      }),
    } as const)
)

export default Files
