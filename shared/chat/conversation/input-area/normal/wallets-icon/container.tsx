import * as Container from '../../../../../util/container'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import WalletsIconRender from '.'

type OwnProps = {
  size: number
  style?: Styles.StylesCrossPlatform
}

const WalletsIcon = Container.namedConnect(
  state => {
    const participantInfo = Constants.getParticipantInfo(state, Constants.getSelectedConversation(state))
    const otherParticipants = participantInfo.name.filter(u => u !== state.config.username)
    const _to = otherParticipants[0]
    return {_to}
  },
  dispatch => ({
    _onClick: (to: string, isRequest: boolean) =>
      dispatch(WalletsGen.createOpenSendRequestForm({isRequest, recipientType: 'keybaseUser', to})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    onRequest: () => dispatchProps._onClick(stateProps._to, true),
    onSend: () => dispatchProps._onClick(stateProps._to, false),
    size: ownProps.size,
    style: ownProps.style,
  }),
  'WalletsIcon'
)(WalletsIconRender)

export default WalletsIcon
