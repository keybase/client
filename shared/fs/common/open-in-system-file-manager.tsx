import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as T from '../../constants/types'
import * as C from '../../constants'
import {fileUIName} from '../../constants/platform'
import SystemFileManagerIntegrationPopup from './sfmi-popup'

type Props = {path: T.FS.Path}

const OpenInSystemFileManager = ({path}: Props) => {
  const openPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openPathInSystemFileManagerDesktop
  )
  const openInSystemFileManager = () => openPathInSystemFileManagerDesktop?.(path)
  return (
    <Kb.WithTooltip tooltip={`Show in ${fileUIName}`}>
      <Kb.Icon
        type="iconfont-finder"
        padding="tiny"
        onClick={openInSystemFileManager}
        color={Styles.globalColors.black_50}
        hoverColor={Styles.globalColors.black}
      />
    </Kb.WithTooltip>
  )
}

const OpenInSFM = (props: Props) => {
  const sfmiBannerDismissed = C.useFSState(s => s.settings.sfmiBannerDismissed)
  const shouldHideFileManagerIcon = C.useFSState(
    s => s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled && sfmiBannerDismissed
  )
  const showOpenInSystemFileManager = C.useFSState(
    s => s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled
  )

  if (shouldHideFileManagerIcon) return null

  return showOpenInSystemFileManager ? (
    <OpenInSystemFileManager {...props} />
  ) : (
    <SystemFileManagerIntegrationPopup mode="Icon" />
  )
}
export default OpenInSFM
