import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from '.'

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
          selected={<Kb.Text type="Body">{this.props.humanizedNotificationThreshold}</Kb.Text>}
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

const Files = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.syncContent} gap="tiny">
      <Kb.Text type="Header">Sync</Kb.Text>
      <Kb.Checkbox
        onCheck={
          props.spaceAvailableNotificationThreshold === 0
            ? props.onEnableSyncNotifications
            : props.onDisableSyncNotifications
        }
        label="Warn when low on storage space"
        checked={props.spaceAvailableNotificationThreshold !== 0}
        disabled={props.areSettingsLoading}
        style={styles.syncNotificationCheckbox}
      />
      {!!props.spaceAvailableNotificationThreshold && <Kb.Text type="BodySmallSemibold">Threshold:</Kb.Text>}
      {!!props.spaceAvailableNotificationThreshold && <ThresholdDropdown {...props} />}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      syncNotificationCheckbox: {
        alignItems: 'center',
      },
    } as const)
)

export default Kb.HeaderHoc(Files)
