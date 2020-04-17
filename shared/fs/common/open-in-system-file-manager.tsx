import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {fileUIName} from '../../constants/platform'
import * as Container from '../../util/container'
import * as Kbfs from '../common'

type Props = {
  path: Types.Path
}

const OpenInSystemFileManager = ({path}: Props) => {
  const dispatch = Container.useDispatch()
  const openInSystemFileManager = () => dispatch(FsGen.createOpenPathInSystemFileManager({path}))
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

const shouldHideFileManagerIcon = (driverStatus: Types.DriverStatus, settings: Types.Settings) =>
  driverStatus.type === Types.DriverStatusType.Disabled && settings.sfmiBannerDismissed

const OpenInSFM = (props: Props) => {
  const driverStatus = Container.useSelector(state => state.fs.sfmi.driverStatus)
  const settings = Container.useSelector(state => state.fs.settings)
  if (shouldHideFileManagerIcon(driverStatus, settings)) {
    return null
  }
  return driverStatus.type === Types.DriverStatusType.Enabled ? (
    <OpenInSystemFileManager {...props} />
  ) : (
    <Kbfs.SystemFileManagerIntegrationPopup mode="Icon" />
  )
}
export default OpenInSFM
