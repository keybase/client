// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import ReactionsRow from '.'

export type OwnProps = {
  messageID: Types.MessageID,
}

// TODO
const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  emojis: [],
})

export default compose(connect(mapStateToProps, null, mergeProps), setDisplayName('ReactionsRow'))(
  ReactionsRow
)
