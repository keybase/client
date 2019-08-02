import * as SettingsGen from '../../actions/settings-gen'
import UpdateEmail from './index'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'

type OwnProps = {}
const mapStateToProps = state => {
  const {waitingForResponse} = state.settings
  const {emails, error} = state.settings.email
  let email = ''
  let isVerified = false
  if (emails && emails.count() > 0) {
    const first_email = emails.get(0)
    if (first_email) {
      email = first_email.get('email')
      isVerified = first_email.get('isVerified')
    }
  }
  return {
    email,
    error,
    isVerified,
    waitingForResponse,
  }
}

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSave: email => {
    dispatch(SettingsGen.createOnChangeNewEmail({email}))
    dispatch(SettingsGen.createOnSubmitNewEmail())
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
    (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(UpdateEmail)
