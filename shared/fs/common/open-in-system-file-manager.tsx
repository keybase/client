import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as C from '@/constants'
import SystemFileManagerIntegrationPopup from './sfmi-popup'
import {useFSState} from '@/constants/fs'

type Props = {path: T.FS.Path}

const OpenInSystemFileManager = React.memo(function OpenInSystemFileManager({path}: Props) {
  const openPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.dynamic.openPathInSystemFileManagerDesktop
  )
  const openInSystemFileManager = React.useCallback(
    () => openPathInSystemFileManagerDesktop?.(path),
    [openPathInSystemFileManagerDesktop, path]
  )
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
})

const OpenInSFM = (props: Props) => {
  const {sfmiBannerDismissed, shouldHideFileManagerIcon, showOpenInSystemFileManager} = useFSState(
    C.useShallow(s => {
      const sfmiBannerDismissed = s.settings.sfmiBannerDismissed
      const driverStatusType = s.sfmi.driverStatus.type
      return {
        sfmiBannerDismissed,
        shouldHideFileManagerIcon:
          driverStatusType === T.FS.DriverStatusType.Disabled && sfmiBannerDismissed,
        showOpenInSystemFileManager: driverStatusType === T.FS.DriverStatusType.Enabled,
      }
    })
  )

  if (shouldHideFileManagerIcon) return null

  return showOpenInSystemFileManager ? (
    <OpenInSystemFileManager {...props} />
  ) : (
    <SystemFileManagerIntegrationPopup mode="Icon" />
  )
}
export default OpenInSFM
