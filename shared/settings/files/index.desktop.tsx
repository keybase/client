import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Platform from '@/constants/platform'
import * as Kbfs from '@/fs/common'
import RefreshDriverStatusOnMount from '@/fs/common/refresh-driver-status-on-mount'
import RefreshSettings from './refresh-settings'
import useFiles from './hooks'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'
type Props = ReturnType<typeof useFiles>

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

const SyncNotificationSetting = (
  p: Pick<Props, 'spaceAvailableNotificationThreshold' | 'areSettingsLoading'>
) => {
  const setSpaceAvailableNotificationThreshold = useFSState(
    s => s.dispatch.setSpaceAvailableNotificationThreshold
  )
  const onChangedSyncNotifications = (selectedIdx: number) =>
    setSpaceAvailableNotificationThreshold(allowedNotificationThresholds[selectedIdx] ?? 0)
  const {spaceAvailableNotificationThreshold, areSettingsLoading} = p
  return (
    <Kb.Box2 direction="horizontal" alignItems="center">
      <Kb.Text type="Body">Warn me if I have less than </Kb.Text>
      <Kb.Dropdown
        items={allowedNotificationThresholds.map(i => (
          <Kb.Text type="Body" key={i}>
            {FS.humanizeBytes(i, 0)}
          </Kb.Text>
        ))}
        onChangedIdx={onChangedSyncNotifications}
        overlayStyle={styles.syncNotificationDropdownOverlay}
        selected={
          <Kb.Box2
            direction="horizontal"
            key={spaceAvailableNotificationThreshold || defaultNotificationThreshold}
          >
            <Kb.Text type="Body">
              {FS.humanizeBytes(spaceAvailableNotificationThreshold || defaultNotificationThreshold, 0)}
            </Kb.Text>
          </Kb.Box2>
        }
        style={styles.syncNotificationSettingDropdown}
        itemBoxStyle={styles.syncNotificationDropdownItem}
        disabled={areSettingsLoading || spaceAvailableNotificationThreshold === 0}
      />
      <Kb.Text type="Body">of storage space remaining</Kb.Text>
    </Kb.Box2>
  )
}

const FinderIntegration = () => {
  const {driverStatus, preferredMountDirs, driverDisable, openLocalPathInSystemFileManagerDesktop} =
    useFSState(
      C.useShallow(s => ({
        driverDisable: s.dispatch.driverDisable,
        driverStatus: s.sfmi.driverStatus,
        openLocalPathInSystemFileManagerDesktop: s.dispatch.defer.openLocalPathInSystemFileManagerDesktop,
        preferredMountDirs: s.sfmi.preferredMountDirs,
      }))
    )
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onShowKextPermissionPopup = () => {
    navigateAppend('kextPermission')
  }
  const displayingMountDir = preferredMountDirs[0] || ''
  const openMount = displayingMountDir
    ? () => openLocalPathInSystemFileManagerDesktop?.(displayingMountDir)
    : undefined
  const disable = driverDisable

  const isPending =
    driverStatus.type === T.FS.DriverStatusType.Unknown ||
    (driverStatus.type === T.FS.DriverStatusType.Enabled && driverStatus.isDisabling) ||
    (driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.isEnabling)

  return Platform.isDarwin || Platform.isWindows ? (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.finderIntegrationContent}>
        <Kb.Box>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.contentHeader}>
            <Kb.Text type="Header">{Platform.fileUIName} integration</Kb.Text>
            {isPending && <Kb.ProgressIndicator style={styles.spinner} />}
            {driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.kextPermissionError && (
              <Kb.ClickableBox style={styles.actionNeededBox} onClick={onShowKextPermissionPopup}>
                <Kb.Text style={styles.actionNeededText} type="BodySmallSemibold">
                  Action needed!
                </Kb.Text>
              </Kb.ClickableBox>
            )}
          </Kb.Box2>
          {driverStatus.type === T.FS.DriverStatusType.Enabled ? (
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
                {
                  "Get access to your files and folders just like you normally do with your local files. It's encrypted and secure."
                }
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

const FilesSettings = () => {
  const props = useFiles()

  return (
    <>
      <RefreshDriverStatusOnMount />
      <RefreshSettings />
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <FinderIntegration />
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
              labelComponent={
                <SyncNotificationSetting
                  spaceAvailableNotificationThreshold={props.spaceAvailableNotificationThreshold}
                  areSettingsLoading={props.areSettingsLoading}
                />
              }
              checked={props.spaceAvailableNotificationThreshold !== 0}
              disabled={props.areSettingsLoading}
              style={styles.syncNotificationCheckbox}
            />
          </Kb.Box>
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionNeededBox: {
        marginLeft: Kb.Styles.globalMargins.medium,
      },
      actionNeededText: {
        color: Kb.Styles.globalColors.redDark,
      },
      buttonBox: {
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      contentHeader: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
      },
      divider: {
        marginTop: Kb.Styles.globalMargins.medium,
      },
      finderIntegrationContent: {
        padding: Kb.Styles.globalMargins.small,
      },
      spinner: {
        height: 16,
        width: 16,
      },
      syncContent: {
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.medium,
      },
      syncNotificationCheckbox: {
        alignItems: 'center',
      },
      syncNotificationDropdownItem: {
        alignItems: 'center',
        paddingLeft: Kb.Styles.globalMargins.small,
      },
      syncNotificationDropdownOverlay: {
        width: Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.medium,
      },
      syncNotificationSettingDropdown: {
        marginLeft: Kb.Styles.globalMargins.tiny,
        marginRight: Kb.Styles.globalMargins.tiny,
        width: Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.medium,
      },
    }) as const
)

export default FilesSettings
