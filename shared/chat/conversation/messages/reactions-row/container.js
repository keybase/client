// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import ReactionsRow from '.'

export type OwnProps = {
  messageID: MessageTypes.MessageID,
}

// TODO
const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({})

export default compose(connect(mapStateToProps), setDisplayName('ReactionsRow'))(ReactionsRow)
