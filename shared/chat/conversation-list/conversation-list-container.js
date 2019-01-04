// @flow
import {namedConnect} from '../../util/container'
import ConversationList from './conversation-list'

type OwnProps = {
  onSelect?: () => void,
}

const mapStateToProps = state => ({})
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  hiddenCount: 0,
  rows: [],
  toggleExpand: () => {},
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConversationList'
)(ConversationList)
