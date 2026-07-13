import * as React from 'react'
import * as T from '@/constants/types'
import {useOpen} from '@/fs/common/use-open'
import * as FS from '@/constants/fs'
import {rowStyles, StillCommon} from './common'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type OwnProps = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
  name: T.FS.TlfType
}

const TLFTypeContainer = (p: OwnProps) => {
  const {destinationPickerSource, name} = p
  const path = T.FS.stringToPath(`/keybase/${name}`)
  const onOpen = useOpen({destinationPickerSource, path})

  return (
    <StillCommon
      testID={TestIDs.FILES_TLF_ROW}
      path={path}
      inDestinationPicker={!!destinationPickerSource}
      onOpen={onOpen}
      writingToJournal={false}
      content={
        <Kb.Text
          type={FS.pathTypeToTextType(T.FS.PathType.Folder)}
          style={rowStyles.rowText}
          lineClamp={isMobile ? 1 : undefined}
        >
          {T.FS.getPathName(path)}
        </Kb.Text>
      }
    />
  )
}

// memo: fs root rebuilds section data on every FsDataContext write; props are
// primitives so rows bail
export default React.memo(TLFTypeContainer)
