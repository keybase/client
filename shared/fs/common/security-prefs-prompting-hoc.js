// @flow
import {branch, compose, connect, renderNothing, type TypedState} from '../../util/container'
import {isLinux, isMobile} from '../../constants/platform'
import * as FsGen from '../../actions/fs-gen'
import {navigateAppend} from '../../actions/route-tree'

// On desktop, SecurityPrefsPromptingHoc prompts user about going to security
// preferences to allow the kext if needed. It prompts at most once per
// app-restart. Which means for example, if the user goes to Files tab and gets
// an prompt. they won't get prompted again in Settings, or after they click
// "Back" in the prompt and go back to Files tab again. This is to avoid
// spamming the user.  We have a link in the Settings page so if the user wants
// they can still find the instructions.

const mapStateToProps = (state: TypedState) => {
  const {securityPrefsPropmted, kextPermissionError} = state.fs.flags
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    shouldPromptSecurityPrefs: !securityPrefsPropmted && !kbfsEnabled && kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  showSecurityPrefsOnce: () => {
    dispatch(
      FsGen.createSetFlags({
        securityPrefsPropmted: true,
      })
    )
    dispatch(
      navigateAppend([
        {
          props: {},
          selected: 'securityPrefs',
        },
      ])
    )
  },
})

const displayOnce = ({shouldPromptSecurityPrefs, showSecurityPrefsOnce}) => {
  shouldPromptSecurityPrefs && showSecurityPrefsOnce()
  return shouldPromptSecurityPrefs
}

const DesktopSecurityPrefsPromptingHoc = compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  branch(displayOnce, renderNothing)
)

const SecurityPrefsPromptingHoc = isMobile ? (i: any) => i : DesktopSecurityPrefsPromptingHoc

export default SecurityPrefsPromptingHoc
