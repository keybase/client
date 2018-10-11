// @flow
import * as SettingsGen from '../../actions/settings-gen'
import UpdateEmail from './index'
import {navigateUp} from '../../actions/route-tree'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const {waitingForResponse} = state.settings
  const {emails, error} = state.settings.email
  let email = ''
  let isVerified = false
  if (emails.length > 0) {
    email = emails[0].email
    isVerified = emails[0].isVerified
  }
  return {
    email,
    error,
    isVerified,
    waitingForResponse,
  }
}

const mapDispatchToProps = (dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onSave: email => {
    dispatch(SettingsGen.createOnChangeNewEmail({email}))
    dispatch(SettingsGen.createOnSubmitNewEmail())
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(UpdateEmail)
