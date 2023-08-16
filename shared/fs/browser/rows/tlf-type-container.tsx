import * as T from '../../../constants/types'
import {useOpen} from '../../common/use-open'
import TlfType from './tlf-type'

type OwnProps = {
  destinationPickerIndex?: number
  name: T.FS.TlfType
}

const TLFTypeContainer = (p: OwnProps) => {
  const {destinationPickerIndex, name} = p
  const path = T.FS.stringToPath(`/keybase/${name}`)
  const onOpen = useOpen({destinationPickerIndex, path})
  const np = {
    destinationPickerIndex,
    name,
    onOpen,
    path,
  }

  return <TlfType {...np} />
}
export default TLFTypeContainer
