import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import {fileUIName, isLinux} from '../../constants/platform'
import * as Styles from '../../styles'
import SystemFileManagerIntegrationBanner from '../../fs/banner/system-file-manager-integration-banner/container'
import RefreshDriverStatusOnMount from '../../fs/common/refresh-driver-status-on-mount'

type Props = {
  driverStatus: Types.DriverStatus
  onEnable: () => void
  onDisable: () => void
  onShowKextPermissionPopup: () => void
}

const EnableSystemFileManagerIntegration = (props: Props) => (
  <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
    <Kb.Text type="Body">Enable Keybase in {fileUIName}</Kb.Text>
    <Kb.Text type="BodySmall">
      Access your Keybase files just like you normally do with your local files.
    </Kb.Text>
  </Kb.Box>
)

const isPending = (props: Props) =>
  props.driverStatus.type === Types.DriverStatusType.Unknown ||
  (props.driverStatus.type === Types.DriverStatusType.Enabled && props.driverStatus.isDisabling) ||
  (props.driverStatus.type === Types.DriverStatusType.Disabled && props.driverStatus.isEnabling)

export default (props: Props) => (
  <>
    <RefreshDriverStatusOnMount />
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
      <SystemFileManagerIntegrationBanner alwaysShow={true} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.mainContent}>
        {!isLinux && (
          <Kb.Box>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.contentHeader}>
              <Kb.Text type="BodySmallSemibold">{fileUIName} integration</Kb.Text>
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
                props.driverStatus.type === Types.DriverStatusType.Enabled ? props.onDisable : props.onEnable
              }
              labelComponent={<EnableSystemFileManagerIntegration {...props} />}
              checked={props.driverStatus.type === Types.DriverStatusType.Enabled}
              disabled={isPending(props)}
            />
          </Kb.Box>
        )}
      </Kb.Box2>
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
  mainContent: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.medium,
  },
  spinner: {
    height: 16,
    width: 16,
  },
})
