import {ExitCodeLegacyHelperInstalled} from '@/constants/values'

// The JSON `keybase install`, `keybase install-auto` and `keybase uninstall` print with --format=json
export type InstallResultJSON =
  | {
      componentResults?: Array<{
        exitCode?: number
        status?: {
          code?: number
          desc?: string
        }
        name?: string
      }>
      status?: {desc?: string}
    }
  | undefined

// install-auto reports a still-installed legacy helper as an OK `helper` result with this exit code
export const legacyHelperInstalled = (result: InstallResultJSON) =>
  !!result?.componentResults?.some(c => c.name === 'helper' && c.exitCode === ExitCodeLegacyHelperInstalled)

// Reads `keybase uninstall --components=helper --format=json`
export const legacyHelperRetirementResult = (stdout: string): {ok: boolean; desc: string} => {
  let result: InstallResultJSON
  try {
    result = JSON.parse(stdout) as InstallResultJSON
  } catch {
    result = undefined
  }
  const helper = result?.componentResults?.find(c => c.name === 'helper')
  if (!helper) {
    return {desc: 'The uninstall did not report a result.', ok: false}
  }
  return {desc: helper.status?.desc ?? '', ok: helper.status?.code === 0}
}

export type CommandLineToolResult = {ok: boolean; desc: string}

// `keybase install` exits non-zero when a component fails but still prints its result, so stdout is
// read first and the exec error is only the fallback.
export const commandLineToolResult = (
  execError: string | undefined,
  attempted: boolean,
  stdout: string
): CommandLineToolResult => {
  if (!attempted) {
    return {desc: 'Keybase could not find its command line installer.', ok: false}
  }
  let result: InstallResultJSON
  try {
    result = JSON.parse(stdout) as InstallResultJSON
  } catch {
    result = undefined
  }
  const clipaths = result?.componentResults?.find(c => c.name === 'clipaths')
  if (clipaths) {
    return {desc: clipaths.status?.desc ?? '', ok: clipaths.status?.code === 0}
  }
  return {
    desc: result?.status?.desc || execError || 'The install did not report a result.',
    ok: false,
  }
}
