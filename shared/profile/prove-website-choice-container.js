// @flow
import ProveWebsiteChoice from './prove-website-choice'
import {addProof, cancelAddProof} from '../actions/profile'
import {connect} from 'react-redux'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // Pass https to addProof because addProof doesn't actually care if it's http/https, it will try
  // both with a preference for https
  onCancel: () => dispatch(cancelAddProof()),
  onOptionClick: choice => dispatch(addProof(choice === 'file' ? 'https' : 'dns')),
})

export default connect(mapStateToProps, mapDispatchToProps)(ProveWebsiteChoice)
