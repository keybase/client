import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'
import {Props} from '.'

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

class ThresholdDropdown extends React.PureComponent<Props, {visible: boolean}> {
  state = {visible: false}
  _hide = () => this.setState({visible: false})
  _select = selectedVal => this.props.onSetSyncNotificationThreshold(selectedVal)
  _show = () => this.setState({visible: true})
  _toggleShowingMenu = () => this.setState(s => ({visible: !s.visible}))
  render() {
    return (
      <>
        <Kb.DropdownButton
          onPress={this.state.visible ? this._show : this._hide}
          disabled={!this.props.spaceAvailableNotificationThreshold}
          selected={<Kb.Text type="Body">{this.props.humanizedNotificationThreshold}</Kb.Text>}
          toggleOpen={this._toggleShowingMenu}
        />
        <Kb.FloatingPicker
          items={this.props.allowedThresholds}
          visible={this.state.visible}
          selectedValue={this.props.humanizedNotificationThreshold}
          promptString="Pick a threshold"
          prompt={
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" centerChildren={true}>
              <Kb.Text type="BodySmallSemibold">Pick a threshold</Kb.Text>
            </Kb.Box2>
          }
          onCancel={this._hide}
          onHidden={this._hide}
          onDone={this._hide}
          onSelect={this._select}
        />
      </>
    )
  }
}

const SyncNotificationSetting = (props: Props) => (
  <Kb.Box2
    direction="horizontal"
    alignItems="flex-start"
    fullWidth={true}
    style={{flex: 1, flexWrap: 'wrap'}}
  >
    <Kb.Text type="Body">Warn me if I have less than </Kb.Text>
    <ThresholdDropdown {...props} />
    <Kb.Text type="Body">of storage space remaining</Kb.Text>
  </Kb.Box2>
)

const isPending = (props: Props) =>
  props.driverStatus.type === Types.DriverStatusType.Unknown ||
  (props.driverStatus.type === Types.DriverStatusType.Enabled && props.driverStatus.isDisabling) ||
  (props.driverStatus.type === Types.DriverStatusType.Disabled && props.driverStatus.isEnabling)

const Files = (props: Props) => (
  <>
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
      {(true || flags.kbfsOfflineMode) && (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.syncContent}>
          <Kb.Box>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.contentHeader}>
              <Kb.Text type="BodySmallSemibold">Sync</Kb.Text>
            </Kb.Box2>
            <Kb.Checkbox
              onCheck={
                props.spaceAvailableNotificationThreshold === 0
                  ? props.onEnableSyncNotifications
                  : props.onDisableSyncNotifications
              }
              labelComponent={<SyncNotificationSetting {...props} />}
              checked={props.spaceAvailableNotificationThreshold !== 0}
              disabled={props.areSettingsLoading}
              style={styles.syncNotificationCheckbox}
            />
          </Kb.Box>
        </Kb.Box2>
      )}
    </Kb.Box2>
  </>
)

const styles = Styles.styleSheetCreate({
  contentHeader: {
    paddingBottom: Styles.globalMargins.tiny,
  },
  syncContent: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.medium,
  },
  syncNotificationCheckbox: {
    alignItems: 'center',
  },
})

export default Kb.HeaderHoc(Files)
