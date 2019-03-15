// @flow
import Search from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import {connect} from '../../util/container'

type OwnProps = {|onClose: () => void|}

const mapDispatchToProps = (dispatch, ownProps) => ({
  onClick: username => {
    ownProps.onClose()
    dispatch(createShowUserProfile({username}))
  },
})

const connected = connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Search)

export default connected
