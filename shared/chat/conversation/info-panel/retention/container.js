// @flow
import {type TypedState, connect} from '../../../../util/container'
import {type OwnProps} from '../../../../teams/team/settings/retention/container'
import {getCanPerform} from '../../../../constants/teams'
import RetentionWithSaveState from '.'

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  let showSaveState = true
  if (ownProps.teamname) {
    const yourOperations = getCanPerform(state, ownProps.teamname)
    showSaveState = yourOperations.setRetentionPolicy
  }
  return {
    showSaveState,
  }
}

export default connect(mapStateToProps)(RetentionWithSaveState)
