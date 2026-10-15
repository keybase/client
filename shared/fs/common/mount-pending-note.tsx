import * as C from '@/constants'
import {macfuseNetworkVolumeNote} from './macfuse-prompt'
import {useSystemFileManagerIntegration} from './sfmi'

const mountPendingNote = `Keybase is not in ${C.fileUIName} yet. If macOS asked whether "kbfs" may access files on a network volume, click Allow. If you clicked Don't Allow, allow "kbfs" under Network Volumes in System Settings › Privacy & Security › Files & Folders.`

// The note shown wherever an enable can start: once an enable stopped waiting for the mount, how to allow kbfs;
// otherwise on macOS, the heads-up about the network volume prompt. Both cover the same Allow step.
export const useEnableNote = (): string | undefined => {
  const {mountPending} = useSystemFileManagerIntegration()
  return mountPending ? mountPendingNote : C.isDarwin ? macfuseNetworkVolumeNote : undefined
}
