import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {fileUIName} from '../../constants/platform'
import * as Container from '../../util/container'
import SystemFileManagerIntegrationPopup from './sfmi-popup'

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

const OpenInSFM = (props: Props) => {
  const shouldHideFileManagerIcon = Container.useSelector(
    state =>
      state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Disabled &&
      state.fs.settings.sfmiBannerDismissed
  )
  const showOpenInSystemFileManager = Container.useSelector(
    state => state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled
  )

  if (shouldHideFileManagerIcon) return null

  return showOpenInSystemFileManager ? (
    <OpenInSystemFileManager {...props} />
  ) : (
    <SystemFileManagerIntegrationPopup mode="Icon" />
  )
}
export default OpenInSFM
