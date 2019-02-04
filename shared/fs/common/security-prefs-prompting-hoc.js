// @flow
import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {connect} from '../../util/container'
import {isMobile} from '../../constants/platform'
import * as RouteTreeGen from '../../actions/route-tree-gen'

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
  const kbfsEnabled = Constants.kbfsEnabled(state)
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
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {},
            selected: 'securityPrefs',
          },
        ],
      })
    )
  },
})

const displayOnce = ({shouldPromptSecurityPrefs, showSecurityPrefsOnce}) => {
  shouldPromptSecurityPrefs && showSecurityPrefsOnce()
  return shouldPromptSecurityPrefs
}

const DesktopSecurityPrefsBranch = <P>(
  ComposedComponent: React.ComponentType<P>
): React.ComponentType<MergedProps & P> =>
  class extends React.PureComponent<MergedProps & P> {
    render = () => (!displayOnce(this.props) ? <ComposedComponent {...this.props} /> : null)
  }

const DesktopSecurityPrefsPromptingHoc = <P>(
  ComposedComponent: React.ComponentType<P>
): React.ComponentType<P> =>
  connect<P, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  )(DesktopSecurityPrefsBranch<P>(ComposedComponent))

const SecurityPrefsPromptingHoc = isMobile
  ? <P>(i: React.ComponentType<P>): React.ComponentType<P> => i
  : DesktopSecurityPrefsPromptingHoc

export default SecurityPrefsPromptingHoc
