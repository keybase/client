import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'
import type {Props} from '.'

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

const ThresholdDropdown = (props: Props) => {
  const [notificationThreshold, setNotificationThreshold] = React.useState(
    props.spaceAvailableNotificationThreshold
  )
  const [visible, setVisible] = React.useState(false)

  const hide = () => setVisible(false)
  const done = () => {
    props.onSetSyncNotificationThreshold(notificationThreshold)
    setVisible(false)
  }
  const select = (selectedVal?: number) => selectedVal && setNotificationThreshold(selectedVal)
  const toggleShowingMenu = () => setVisible(v => !v)

  return (
    <>
      <Kb.DropdownButton
        disabled={!props.spaceAvailableNotificationThreshold}
        selected={
          <Kb.Text type="Body" style={styles.selectedText}>
            {props.humanizedNotificationThreshold}
          </Kb.Text>
        }
        toggleOpen={toggleShowingMenu}
      />
      <Kb.FloatingPicker
        items={props.allowedThresholds}
        visible={visible}
        selectedValue={notificationThreshold}
        promptString="Pick a threshold"
        prompt={
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" centerChildren={true}>
            <Kb.Text type="BodySmallSemibold">Pick a threshold</Kb.Text>
          </Kb.Box2>
        }
        onCancel={hide}
        onHidden={hide}
        onDone={done}
        onSelect={select}
      />
    </>
  )
}

const Files = (props: Props) => {
  const syncOnCellular = C.useFSState(s => s.settings.syncOnCellular)
  const toggleSyncOnCellular = () => {
    T.RPCGen.SimpleFSSimpleFSSetSyncOnCellularRpcPromise(
      {syncOnCellular: !syncOnCellular},
      Constants.setSyncOnCellularWaitingKey
    )
      .then(() => {})
      .catch(() => {})
  }
  const waitingToggleSyncOnCellular = C.Waiting.useAnyWaiting(Constants.setSyncOnCellularWaitingKey)
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      alignItems={Kb.Styles.isTablet ? 'flex-start' : 'center'}
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
          gapSize={Kb.Styles.globalMargins.small}
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
          gapSize={Kb.Styles.globalMargins.small}
          style={styles.switch}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      selectedText: {
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        width: '100%',
      },
      switch: {
        marginTop: Kb.Styles.globalMargins.small,
      },
      syncContent: Kb.Styles.platformStyles({
        common: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
          paddingTop: Kb.Styles.globalMargins.medium,
        },
        isTablet: {
          maxWidth: 410,
        },
      }),
    }) as const
)

export default Files
