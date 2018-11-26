// @flow
import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import {connect} from '../../util/container'
import {isLinux, isMobile} from '../../constants/platform'
import {navigateAppend} from '../../actions/route-tree'

// On desktop, SecurityPrefsPromptingHoc prompts user about going to security
// preferences to allow the kext if needed. It prompts at most once per
// app-restart. Which means for example, if the user goes to Files tab and gets
// an prompt. they won't get prompted again in Settings, or after they click
// "Back" in the prompt and go back to Files tab again. This is to avoid
// spamming the user.  We have a link in the Settings page so if the user wants
// they can still find the instructions.

type MergedProps = {|
  shouldPromptSecurityPrefs: boolean,
  showSecurityPrefsOnce: () => void,
|}

const mapStateToProps = state => {
  const {securityPrefsPrompted, kextPermissionError} = state.fs.flags
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    shouldPromptSecurityPrefs: !securityPrefsPrompted && !kbfsEnabled && kextPermissionError,
  }
}

const mapDispatchToProps = dispatch => ({
  showSecurityPrefsOnce: () => {
    dispatch(
      FsGen.createSetFlags({
        securityPrefsPrompted: true,
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

const ConnectedDesktopSecurityPrefs = connect<{||}, _, React.ComponentType<MergedProps>, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)

const DesktopSecurityPrefsBranch = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<MergedProps> {
    render = () => !displayOnce(this.props) ? <ComposedComponent {...this.props} /> : null
  }

const DesktopSecurityPrefsPromptingHoc = (ComposedComponent: React.ComponentType<any>) =>
  ConnectedDesktopSecurityPrefs(DesktopSecurityPrefsBranch(ComposedComponent))

const SecurityPrefsPromptingHoc = isMobile ? (i: any) => i : DesktopSecurityPrefsPromptingHoc

export default SecurityPrefsPromptingHoc
