// From iOS 27 a simulator asks "Open in “Keybase”?" for every simctl openurl and does not remember
// the answer, which stalls every flow that opens a link. An approval in launchservices' defaults for
// simctl's opener (CoreSimulatorBridge) skips the ask; iOS 26 never asks, and the approval is harmless
// there. The app declares one scheme, keybase (ios/Keybase/Info.plist); the bundle id is approved too.
import {execFileSync} from 'child_process'

type Exec = (file: string, args: ReadonlyArray<string>) => string

const OPENER = 'com.apple.CoreSimulator.CoreSimulatorBridge'
const BUNDLE_ID = 'keybase.ios'

const realExec: Exec = (file, args) =>
  execFileSync(file, args, {encoding: 'utf8', killSignal: 'SIGKILL', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000})

export const approveKeybaseLinks = (udid: string, exec: Exec = realExec) => {
  for (const target of ['keybase', BUNDLE_ID]) {
    exec('xcrun', ['simctl', 'spawn', udid, 'defaults', 'write', 'com.apple.launchservices.schemeapproval', `${OPENER}-->${target}`, '-string', BUNDLE_ID])
  }
}
