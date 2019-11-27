import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import logger from '../../../../../logger'
import WalletsIconRender from '.'

type OwnProps = {
  size: number
  style?: Styles.StylesCrossPlatform
}

const WalletsIcon = Container.namedConnect(
  state => {
    const meta = Constants.getMeta(state, Constants.getSelectedConversation(state))
    const otherParticipants = meta.participants.filter(u => u !== state.config.username)
    if (otherParticipants.length !== 1) {
      logger.warn('WalletsIcon: conversation has more than 1 other user. selecting first')
    }
    const _to = otherParticipants[0]
    return {
      _to,
      isNew: state.chat2.isWalletsNew,
    }
  },
  dispatch => ({
    _onClick: (to: string, wasNew: boolean, isRequest: boolean) => {
      if (wasNew) {
        dispatch(Chat2Gen.createHandleSeeingWallets())
      }
      dispatch(
        WalletsGen.createOpenSendRequestForm({
          isRequest,
          recipientType: 'keybaseUser',
          to,
        })
      )
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    return {
      isNew: stateProps.isNew,
      onRequest: () => dispatchProps._onClick(stateProps._to, stateProps.isNew, true),
      onSend: () => dispatchProps._onClick(stateProps._to, stateProps.isNew, false),
      size: ownProps.size,
      style: ownProps.style,
    }
  },
  'WalletsIcon'
)(WalletsIconRender)

export default WalletsIcon
