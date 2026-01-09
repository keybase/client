import * as T from '@/constants/types'
import {useOpen} from '@/fs/common/use-open'
import * as FS from '@/stores/fs'
import {rowStyles, StillCommon} from './common'
import * as Kb from '@/common-adapters'

type OwnProps = {
  destinationPickerIndex?: number
  name: T.FS.TlfType
}

const TLFTypeContainer = (p: OwnProps) => {
  const {destinationPickerIndex, name} = p
  const path = T.FS.stringToPath(`/keybase/${name}`)
  const onOpen = useOpen({destinationPickerIndex, path})

  return (
    <StillCommon
      path={path}
      onOpen={onOpen}
      writingToJournal={false}
      content={
        <Kb.Text
          fixOverdraw={true}
          type={FS.pathTypeToTextType(T.FS.PathType.Folder)}
          style={rowStyles.rowText}
          lineClamp={Kb.Styles.isMobile ? 1 : undefined}
        >
          {T.FS.getPathName(path)}
        </Kb.Text>
      }
    />
  )
}

export default TLFTypeContainer
