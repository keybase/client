import {
  branch,
  compose,
  connect,
  renderNothing,
  type Dispatch,
  type TypedState,
} from '../../util/container'
import {isLinux} from '../../constants/platform'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {navigateAppend} from '../../actions/route-tree'

// SecurityPrefsHoc prompts user about going to security preferences to allow
// the kext if needed. It prompts at most once per app-restart. Which means for
// example, if the user goes to Files tab and gets an prompt. they won't get
// prompted again in Settings, or after they click "Back" in the prompt and go
// back to Files tab again. This is to avoid spamming the user. We have a link
// in the Settings page so if the user wants they can still find the
// instructions.
const SecurityPrefsHoc = compose(
  connect(
    (state: TypedState) => {
      const {securityPrefsPropmted, kextPermissionError} = state.fs.flags
      const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
      return {
        shouldPromptSecurityPrefs: !securityPrefsPropmted && !kbfsEnabled && kextPermissionError,
      }
    },
    (dispatch: Dispatch) => ({
      showSecurityPrefsOnce: () => {
        dispatch(FsGen.createSetFlags({
          securityPrefsPropmted: true,
        }))
        dispatch(navigateAppend([{
          selected: 'securityPrefs',
        }]))
      },
    }),
  ),
  branch(
    ({shouldPromptSecurityPrefs, showSecurityPrefsOnce}) => {
      shouldPromptSecurityPrefs && showSecurityPrefsOnce()
      return shouldPromptSecurityPrefs
    },
    renderNothing,
  ),
)

export {SecurityPrefsHoc}
