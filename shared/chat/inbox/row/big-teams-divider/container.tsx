import {BigTeamsDivider} from '.'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'

type OwnProps = {
  toggle: () => void
}

export default Container.connect(
  state => ({
    badgeCount: state.chat2.bigTeamBadgeCount,
  }),
  (dispatch, ownProps: OwnProps) => ({
    toggle: () => {
      dispatch(Chat2Gen.createResetSmalls())
      ownProps.toggle()
    },
  }),
  (stateProps, dispatchProps) => ({
    badgeCount: stateProps.badgeCount,
    toggle: dispatchProps.toggle,
  })
)(BigTeamsDivider)
