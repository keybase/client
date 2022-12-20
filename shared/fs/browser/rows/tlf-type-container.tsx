import * as Types from '../../../constants/types/fs'
import {useOpen} from '../../common/use-open'
import TlfType from './tlf-type'

type OwnProps = {
  destinationPickerIndex?: number
  name: Types.TlfType
}

const TLFTypeContainer = (p: OwnProps) => {
  const {destinationPickerIndex, name} = p
  const path = Types.stringToPath(`/keybase/${name}`)
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
