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

const mapStateToProps = state => ({
  _meta: Constants.getMeta(state, Constants.getSelectedConversation(state)),
  _you: state.config.username,
  isNew: state.chat2.isWalletsNew,
})

const mapDispatchToProps = dispatch => ({
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
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const otherParticipants = stateProps._meta.participants.filter(u => u !== stateProps._you)
  if (otherParticipants.size !== 1) {
    logger.warn('WalletsIcon: conversation has more than 1 other user. selecting first')
  }
  const to = otherParticipants.first()
  return {
    isNew: stateProps.isNew,
    onRequest: () => dispatchProps._onClick(to, stateProps.isNew, true),
    onSend: () => dispatchProps._onClick(to, stateProps.isNew, false),
    size: ownProps.size,
    style: ownProps.style,
  }
}

const WalletsIcon = Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'WalletsIcon')(
  WalletsIconRender
)

export default WalletsIcon
