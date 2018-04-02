// @flow
import {type TypedState, connect} from '../../../../util/container'
import {type OwnProps} from '../../../../teams/team/settings/retention/container'
import {getCanPerform, retentionWaitingKey} from '../../../../constants/teams'
import {anyWaiting} from '../../../../constants/waiting'
import RetentionWithSaveState from '.'

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  let showSaveState = true
  let saving = false
  if (['big team', 'small team'].includes(ownProps.entityType) && ownProps.teamname) {
    const teamname = ownProps.teamname
    const yourOperations = getCanPerform(state, teamname)
    saving = anyWaiting(state, retentionWaitingKey(teamname))
    console.log('DANNY CHECKED SAVING', saving)
    showSaveState = yourOperations.setRetentionPolicy
  } else {
  }
  return {
    saving,
    showSaveState,
  }
}

export default connect(mapStateToProps)(RetentionWithSaveState)
