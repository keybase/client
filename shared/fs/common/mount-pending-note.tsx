import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useSystemFileManagerIntegration} from './sfmi'

export const mountPendingNote = `Keybase is not in ${C.fileUIName} yet. If macOS asked whether "kbfs" may access files on a network volume, click Allow. If you clicked Don't Allow, allow "kbfs" under Network Volumes in System Settings › Privacy & Security › Files & Folders.`

type Props = {
  center?: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

// Shown wherever an enable can start, once an enable stopped waiting for the mount.
const MountPendingNote = ({center, style}: Props) => {
  const {mountPending} = useSystemFileManagerIntegration()
  return mountPending ? (
    <Kb.Text type="BodySmall" center={center} style={style}>
      {mountPendingNote}
    </Kb.Text>
  ) : null
}

export default MountPendingNote
