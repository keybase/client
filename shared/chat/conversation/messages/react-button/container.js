// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import ReactButton from '.'

export type OwnProps = {
  emoji: string,
  messageID: MessageTypes.MessageID,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  // TODO
  return {}
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => {
  // TODO
  return {}
}

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('ReactButton'))(
  ReactButton
)
