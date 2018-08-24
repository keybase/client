// @flow
import {TeamsDivider} from '.'
import * as Types from '../../../../constants/types/chat2'
import {connect} from '../../../../util/container'
import type {StylesCrossPlatform} from '../../../../styles'

type OwnProps = {
  showButton: boolean,
  toggle: () => void,
  smallIDsHidden: Array<Types.ConversationIDKey>,
  style?: StylesCrossPlatform,
}

const mapStateToProps = state => ({_badges: state.chat2.badgeMap})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  badgeCount: (ownProps.smallIDsHidden || []).reduce((total, id) => total + stateProps._badges.get(id, 0), 0),
  hiddenCount: ownProps.smallIDsHidden.length,
  showButton: ownProps.showButton,
  style: ownProps.style,
  toggle: ownProps.toggle,
})

export default connect(mapStateToProps, () => ({}), mergeProps)(TeamsDivider)
