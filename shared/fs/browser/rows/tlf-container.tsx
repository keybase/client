import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import {useOpen} from '../../common/use-open'
import Tlf from './tlf'

export type OwnProps = {
  destinationPickerIndex?: number
  disabled: boolean
  mixedMode?: boolean
  name: string
  tlfType: Types.TlfType
}

const TLFContainer = (p: OwnProps) => {
  const {tlfType, name, mixedMode, destinationPickerIndex, disabled} = p
  const tlf = Container.useSelector(state => Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name))
  const username = Container.useSelector(state => state.config.username)
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  const usernames = Constants.getUsernamesFromTlfName(name).filter(name => name !== username)
  const onOpen = useOpen({destinationPickerIndex, path})
  const np = {
    destinationPickerIndex,
    disabled,
    isIgnored: tlf.isIgnored,
    loadPathMetadata: tlf.syncConfig && tlf.syncConfig.mode !== Types.TlfSyncMode.Disabled,
    mixedMode,
    name,
    onOpen,
    path,
    // Only include the user if they're the only one
    usernames: !usernames.length ? [username] : usernames,
  }
  return <Tlf {...np} />
}
export default TLFContainer
