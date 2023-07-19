import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {fileUIName} from '../../constants/platform'
import SystemFileManagerIntegrationPopup from './sfmi-popup'

type Props = {
  path: Types.Path
}

const OpenInSystemFileManager = ({path}: Props) => {
  const openPathInSystemFileManagerDesktop = Constants.useState(
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
  const sfmiBannerDismissed = Constants.useState(s => s.settings.sfmiBannerDismissed)
  const shouldHideFileManagerIcon = Constants.useState(
    s => s.sfmi.driverStatus.type === Types.DriverStatusType.Disabled && sfmiBannerDismissed
  )
  const showOpenInSystemFileManager = Constants.useState(
    s => s.sfmi.driverStatus.type === Types.DriverStatusType.Enabled
  )

  if (shouldHideFileManagerIcon) return null

  return showOpenInSystemFileManager ? (
    <OpenInSystemFileManager {...props} />
  ) : (
    <SystemFileManagerIntegrationPopup mode="Icon" />
  )
}
export default OpenInSFM
