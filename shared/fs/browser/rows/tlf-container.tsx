import * as C from '../../../constants'
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import * as ConfigConstants from '../../../constants/config'
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
  const tlf = C.useFSState(s => Constants.getTlfFromTlfs(s.tlfs, tlfType, name))
  const username = ConfigConstants.useCurrentUserState(s => s.username)
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
