import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import {InlineDropdown} from '../../common-adapters/dropdown'
import * as Platform from '../../constants/platform'
import * as Styles from '../../styles'
import SystemFileManagerIntegrationBanner from '../../fs/banner/system-file-manager-integration-banner/container'
import RefreshDriverStatusOnMount from '../../fs/common/refresh-driver-status-on-mount'
import RefreshSettings from './refresh-settings'
import flags from '../../util/feature-flags'
import {Props} from '.'

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

const EnableSystemFileManagerIntegration = (props: Props) => (
  <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
    <Kb.Text type="Body">Enable Keybase in {Platform.fileUIName}</Kb.Text>
    <Kb.Text type="BodySmall">
      Access your Keybase files just like you normally do with your local files.
    </Kb.Text>
  </Kb.Box>
)

const ThresholdDropdown = (props: Props) => (
  <Kb.Dropdown
    items={allowedNotificationThresholds.map(i => (
      <Kb.Text type="Body" key={i}>
        {Constants.humanizeBytes(i, 0)}
      </Kb.Text>
    ))}
    onChangedIdx={props.onChangedSyncNotifications}
    overlayStyle={styles.syncNotificationDropdownOverlay}
    selected={
      <Kb.Box2
        direction="horizontal"
        key={props.spaceAvailableNotificationThreshold || defaultNotificationThreshold}
      >
        <Kb.Text type="Body">
          {Constants.humanizeBytes(
            props.spaceAvailableNotificationThreshold || defaultNotificationThreshold,
            0
          )}
        </Kb.Text>
      </Kb.Box2>
    }
    style={styles.syncNotificationSettingDropdown}
    itemBoxStyle={styles.syncNotificationDropdownItem}
    disabled={props.areSettingsLoading || props.spaceAvailableNotificationThreshold === 0}
  />
)

const SyncNotificationSetting = (props: Props) => (
  <Kb.Box2 direction="horizontal" alignItems="center">
    <Kb.Text type="Body">Warn me if I have less than </Kb.Text>
    <ThresholdDropdown {...props} />
    <Kb.Text type="Body">of storage space remaining</Kb.Text>
  </Kb.Box2>
)

const isPending = (props: Props) =>
  props.driverStatus.type === Types.DriverStatusType.Unknown ||
  (props.driverStatus.type === Types.DriverStatusType.Enabled && props.driverStatus.isDisabling) ||
  (props.driverStatus.type === Types.DriverStatusType.Disabled && props.driverStatus.isEnabling)

export default (props: Props) => (
  <>
    <RefreshDriverStatusOnMount />
    <RefreshSettings />
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
      <SystemFileManagerIntegrationBanner alwaysShow={true} />
      {(Platform.isDarwin || Platform.isWindows) && (
        <>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.finderIntegrationContent}>
            <Kb.Box>
              <Kb.Box2 direction="horizontal" gap="tiny" style={styles.contentHeader}>
                <Kb.Text type="BodySmallSemibold">{Platform.fileUIName} integration</Kb.Text>
                <Kb.Icon type="iconfont-finder" fontSize={16} color={Styles.globalColors.black_20} />
                {isPending(props) && <Kb.ProgressIndicator style={styles.spinner} />}
                {props.driverStatus.type === Types.DriverStatusType.Disabled &&
                  props.driverStatus.kextPermissionError && (
                    <Kb.ClickableBox style={styles.actionNeededBox} onClick={props.onShowKextPermissionPopup}>
                      <Kb.Text style={styles.actionNeededText} type="BodySmallSemibold">
                        Action needed!
                      </Kb.Text>
                    </Kb.ClickableBox>
                  )}
              </Kb.Box2>
              <Kb.Checkbox
                onCheck={
                  props.driverStatus.type === Types.DriverStatusType.Enabled
                    ? props.onDisable
                    : props.onEnable
                }
                labelComponent={<EnableSystemFileManagerIntegration {...props} />}
                checked={props.driverStatus.type === Types.DriverStatusType.Enabled}
                disabled={isPending(props)}
              />
            </Kb.Box>
          </Kb.Box2>
          {flags.kbfsOfflineMode && <Kb.Divider style={styles.divider} />}
        </>
      )}
      {flags.kbfsOfflineMode && (
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
  actionNeededBox: {
    marginLeft: Styles.globalMargins.medium,
  },
  actionNeededText: {
    color: Styles.globalColors.red,
  },
  contentHeader: {
    paddingBottom: Styles.globalMargins.tiny,
  },
  divider: {
    marginTop: Styles.globalMargins.medium,
  },
  finderIntegrationContent: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.medium,
  },
  spinner: {
    height: 16,
    width: 16,
  },
  syncContent: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.medium,
  },
  syncNotificationCheckbox: {
    alignItems: 'center',
  },
  syncNotificationDropdownItem: {
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.small,
  },
  syncNotificationDropdownOverlay: {
    width: Styles.globalMargins.xlarge + Styles.globalMargins.medium,
  },
  syncNotificationSettingDropdown: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    width: Styles.globalMargins.xlarge + Styles.globalMargins.medium,
  },
})
