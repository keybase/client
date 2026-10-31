// A read of the simulator's own directory on this Mac, kept apart so the jest tests of device.ts
// stand in for it.
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {requireUdid} from './device-lib.ts'

// The identity of a simulator's data: the creation time of Devices/<udid>/data, which CoreSimulator
// makes when it creates the simulator and again when it erases it (the Photos library goes with it).
// Not the Photos database's: Photos makes that only once it first runs, and can rebuild it on its own
// (a library repair, a runtime update), which would add the corpus again to a library that has it.
export const simulatorDataBirth = (udid: string) => {
  const st = fs.statSync(path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices', requireUdid(udid), 'data'), {throwIfNoEntry: false})
  if (!st) throw new Error(`the simulator ${udid} has no data directory`)
  return Math.round(st.birthtimeMs)
}
