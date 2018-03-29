// @flow
import {connect, type TypedState} from '../../../../util/container'
import {retentionSavingKey} from '../../../../constants/chat2'
import {type OwnProps} from '../../../../teams/team/settings/retention/container'
import RetentionWithSaveState from '.'

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  if (!ownProps.conversationIDKey) {
    throw new Error('RetentionWithSaveState needs conversationIDKey')
  }
  const saving = !!state.chat2.loadingMap.get(retentionSavingKey(ownProps.conversationIDKey))
  return {saving}
}

export default connect(mapStateToProps, null)(RetentionWithSaveState)
