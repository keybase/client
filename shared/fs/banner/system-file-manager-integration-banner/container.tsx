import * as React from 'react'
import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/fs'

type OwnProps = {
  alwaysShow?: boolean
}

const SFMIContainer = (op: OwnProps) => {
  const driverStatus = Container.useSelector(state => state.fs.sfmi.driverStatus)
  const settings = Constants.useState(s => s.settings)
  const dispatch = Container.useDispatch()
  const onDisable = React.useCallback(() => dispatch(FsGen.createDriverDisable()), [dispatch])
  const onDismiss = React.useCallback(
    () => dispatch(FsGen.createSetSfmiBannerDismissed({dismissed: true})),
    [dispatch]
  )
  const onEnable = React.useCallback(() => dispatch(FsGen.createDriverEnable({})), [dispatch])
  return (
    <Banner
      alwaysShow={op.alwaysShow}
      driverStatus={driverStatus}
      settings={settings}
      onDisable={onDisable}
      onDismiss={onDismiss}
      onEnable={onEnable}
    />
  )
}
export default SFMIContainer
