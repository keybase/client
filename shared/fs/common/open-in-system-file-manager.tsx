import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as C from '@/constants'
import {useFsErrorActionOrThrow} from '@/fs/common/error-state'
import SystemFileManagerIntegrationPopup from '@/fs/common/sfmi-popup'
import {
  useOpenPathInSystemFileManagerDesktop,
  useSystemFileManagerIntegration,
} from '@/fs/common/sfmi'

type Props = {path: T.FS.Path}

function OpenInSystemFileManager({path}: Props) {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const openPathInSystemFileManagerDesktop = useOpenPathInSystemFileManagerDesktop()
  const openInSystemFileManager = () => openPathInSystemFileManagerDesktop(path, errorToActionOrThrow)
  return (
    <Kb.WithTooltip tooltip={`Show in ${C.fileUIName}`}>
      <Kb.Icon
        type="iconfont-finder"
        padding="tiny"
        onClick={openInSystemFileManager}
        color={Kb.Styles.globalColors.black_50}
        hoverColor={Kb.Styles.globalColors.black}
      />
    </Kb.WithTooltip>
  )
}

const OpenInSFM = (props: Props) => {
  const {driverStatus, sfmiBannerDismissed} = useSystemFileManagerIntegration()
  const driverStatusType = driverStatus.type
  const shouldHideFileManagerIcon =
    driverStatusType === T.FS.DriverStatusType.Disabled && sfmiBannerDismissed
  const showOpenInSystemFileManager = driverStatusType === T.FS.DriverStatusType.Enabled

  if (shouldHideFileManagerIcon) return null

  return showOpenInSystemFileManager ? (
    <OpenInSystemFileManager {...props} />
  ) : (
    <SystemFileManagerIntegrationPopup mode="Icon" />
  )
}
export default OpenInSFM
