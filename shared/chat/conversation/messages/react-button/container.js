// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import ReactButton from '.'

export type OwnProps = {
  emoji: string,
  messageID: Types.MessageID,
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
