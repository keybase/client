import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Platform from '@/constants/platform'
import * as Kbfs from '@/fs/common'
import RefreshDriverStatusOnMount from '@/fs/common/refresh-driver-status-on-mount'
import useFiles from './hooks'
import * as FS from '@/constants/fs'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
type Props = ReturnType<typeof useFiles>

export const allowedNotificationThresholds = [100 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 3, 10 * 1024 ** 3]
export const defaultNotificationThreshold = 100 * 1024 ** 2

// Desktop: inline dropdown row
const SyncNotificationSetting = (
  p: Pick<
    Props,
    'spaceAvailableNotificationThreshold' | 'areSettingsLoading' | 'setSpaceAvailableNotificationThreshold'
  >
) => {
  const onChangedSyncNotifications = (selectedIdx: number) =>
    p.setSpaceAvailableNotificationThreshold(allowedNotificationThresholds[selectedIdx] ?? 0)
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

// Desktop: Finder/Explorer integration section
const FinderIntegration = () => {
  const {driverDisable, driverStatus, preferredMountDirs} = Kbfs.useSystemFileManagerIntegration()
  const navigateAppend = C.Router2.navigateAppend
  const onShowKextPermissionPopup = () => {
    navigateAppend({name: 'kextPermission', params: {}})
  }
  const displayingMountDir = preferredMountDirs[0] || ''
  const openMount = displayingMountDir
    ? () => openLocalPathInSystemFileManagerDesktop(displayingMountDir)
    : undefined
  const disable = driverDisable

  const isPending =
    driverStatus.type === T.FS.DriverStatusType.Unknown ||
    (driverStatus.type === T.FS.DriverStatusType.Enabled && driverStatus.isDisabling) ||
    (driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.isEnabling)

  return Platform.isDarwin || Platform.isWindows ? (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.finderIntegrationContent}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.contentHeader}>
            <Kb.Text type="Header">{Platform.fileUIName} integration</Kb.Text>
            {isPending && <Kb.ProgressIndicator style={styles.spinner} />}
            {driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.kextPermissionError && (
              <Kb.ClickableBox3 direction="vertical" style={styles.actionNeededBox} onClick={onShowKextPermissionPopup}>
                <Kb.Text style={styles.actionNeededText} type="BodySmallSemibold">
                  Action needed!
                </Kb.Text>
              </Kb.ClickableBox3>
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
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Divider style={styles.divider} />
    </>
  ) : null
}

// Mobile: picker for notification threshold
const ThresholdDropdown = (
  p: Pick<Props, 'spaceAvailableNotificationThreshold' | 'setSpaceAvailableNotificationThreshold'>
) => {
  const allowedThresholds = allowedNotificationThresholds.map(
    i => ({label: FS.humanizeBytes(i, 0), value: i}) as const
  )
  const {spaceAvailableNotificationThreshold} = p
  const [notificationThreshold, setNotificationThreshold] = React.useState(
    spaceAvailableNotificationThreshold
  )
  const [visible, setVisible] = React.useState(false)

  const humanizedNotificationThreshold = FS.humanizeBytes(
    spaceAvailableNotificationThreshold || defaultNotificationThreshold,
    0
  )

  const hide = () => setVisible(false)
  const done = () => {
    p.setSpaceAvailableNotificationThreshold(notificationThreshold)
    setVisible(false)
  }
  const select = (selectedVal?: number) => selectedVal && setNotificationThreshold(selectedVal)
  const toggleShowingMenu = () => setVisible(v => !v)

  return (
    <>
      <Kb.DropdownButton
        disabled={!spaceAvailableNotificationThreshold}
        selected={
          <Kb.Text type="Body" style={styles.selectedText}>
            {humanizedNotificationThreshold}
          </Kb.Text>
        }
        toggleOpen={toggleShowingMenu}
      />
      <Kb.FloatingPicker
        items={allowedThresholds}
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

const FilesSettings = () => {
  const props = useFiles()
  if (isMobile) {
    const {
      onDisableSyncNotifications,
      onEnableSyncNotifications,
      setSyncOnCellular,
      spaceAvailableNotificationThreshold,
      syncOnCellular,
    } = props
    const {areSettingsLoading} = props
    const toggleSyncOnCellular = () => {
      setSyncOnCellular(!syncOnCellular)
    }
    const waitingToggleSyncOnCellular = C.Waiting.useAnyWaiting(C.waitingKeyFSSetSyncOnCellular)
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
              spaceAvailableNotificationThreshold === 0
                ? onEnableSyncNotifications
                : onDisableSyncNotifications
            }
            label="Warn when low on storage space"
            on={spaceAvailableNotificationThreshold !== 0}
            disabled={areSettingsLoading}
            gapSize={Kb.Styles.globalMargins.small}
            style={styles.switch}
          />
          {!!spaceAvailableNotificationThreshold && <Kb.Text type="BodySmallSemibold">Threshold:</Kb.Text>}
          {!!spaceAvailableNotificationThreshold && (
            <ThresholdDropdown
              spaceAvailableNotificationThreshold={props.spaceAvailableNotificationThreshold}
              setSpaceAvailableNotificationThreshold={props.setSpaceAvailableNotificationThreshold}
            />
          )}
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

  return (
    <>
      <RefreshDriverStatusOnMount />
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} testID={TestIDs.SETTINGS_FILES}>
        <FinderIntegration />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.syncContent}>
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.contentHeader}>
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
                  setSpaceAvailableNotificationThreshold={props.setSpaceAvailableNotificationThreshold}
                />
              }
              checked={props.spaceAvailableNotificationThreshold !== 0}
              disabled={props.areSettingsLoading}
              style={styles.syncNotificationCheckbox}
            />
          </Kb.Box2>
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
      selectedText: {
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        width: '100%',
      },
      spinner: {
        height: 16,
        width: 16,
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
