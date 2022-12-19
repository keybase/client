import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Platform from '../../constants/platform'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kbfs from '../../fs/common'
import * as FsGen from '../../actions/fs-gen'
import RefreshDriverStatusOnMount from '../../fs/common/refresh-driver-status-on-mount'
import RefreshSettings from './refresh-settings'
import type {Props} from '.'

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

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

const FinderIntegration = (props: Props) => {
  const preferredMountDirs = Container.useSelector(state => state.fs.sfmi.preferredMountDirs)
  const displayingMountDir = preferredMountDirs[0] || ''
  const dispatch = Container.useDispatch()
  const openMount = displayingMountDir
    ? () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: displayingMountDir}))
    : undefined
  const disable = () => dispatch(FsGen.createDriverDisable())
  return Platform.isDarwin || Platform.isWindows ? (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.finderIntegrationContent}>
        <Kb.Box>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.contentHeader}>
            <Kb.Text type="Header">{Platform.fileUIName} integration</Kb.Text>
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
          {props.driverStatus.type === Types.DriverStatusType.Enabled ? (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="Body">Keybase is enabled in {Platform.fileUIName}.</Kb.Text>
              <Kb.Text type="Body">
                Your files are accessible at{' '}
                <Kb.Text type="BodyPrimaryLink" underline={false} onClick={openMount}>
                  {displayingMountDir}
                </Kb.Text>
                .
              </Kb.Text>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.buttonBox}>
                <Kb.Button
                  mode="Secondary"
                  small={true}
                  type="Danger"
                  label="Disable Finder integration"
                  onClick={disable}
                />
              </Kb.Box2>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="BodySmall">
                Get access to your files and folders just like you normally do with your local files. It's
                encrypted and secure.
              </Kb.Text>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.buttonBox}>
                <Kbfs.SystemFileManagerIntegrationPopup mode="Button" />
              </Kb.Box2>
            </Kb.Box2>
          )}
        </Kb.Box>
      </Kb.Box2>
      <Kb.Divider style={styles.divider} />
    </>
  ) : null
}

const FilesSettings = (props: Props) => (
  <>
    <RefreshDriverStatusOnMount />
    <RefreshSettings />
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
      <FinderIntegration {...props} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.syncContent}>
        <Kb.Box>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.contentHeader}>
            <Kb.Text type="Header">File sync</Kb.Text>
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
    </Kb.Box2>
  </>
)
export default FilesSettings

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionNeededBox: {
        marginLeft: Styles.globalMargins.medium,
      },
      actionNeededText: {
        color: Styles.globalColors.redDark,
      },
      buttonBox: {
        paddingTop: Styles.globalMargins.tiny,
      },
      contentHeader: {
        paddingBottom: Styles.globalMargins.tiny,
      },
      divider: {
        marginTop: Styles.globalMargins.medium,
      },
      finderIntegrationContent: {
        padding: Styles.globalMargins.small,
      },
      spinner: {
        height: 16,
        width: 16,
      },
      syncContent: {
        paddingLeft: Styles.globalMargins.small,
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
    } as const)
)
