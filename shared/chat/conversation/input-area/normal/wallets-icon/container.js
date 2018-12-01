// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import WalletsIconRender, {type WalletsIconProps as ViewProps} from '.'

type OwnProps = {|
  size: number,
  style?: Styles.StylesCrossPlatform,
|}

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

const renderNothingProps = {shouldRender: false}
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  // Only show this for adhoc conversations.
  if (stateProps._meta.teamType !== 'adhoc') {
    return renderNothingProps
  }
  const otherParticipants = stateProps._meta.participants.filter(u => u !== stateProps._you)
  // Only show this for one-on-one conversations.
  if (otherParticipants.size !== 1) {
    return renderNothingProps
  }
  const to = otherParticipants.first()
  return {
    isNew: stateProps.isNew,
    onRequest: () => dispatchProps._onClick(to, stateProps.isNew, true),
    onSend: () => dispatchProps._onClick(to, stateProps.isNew, false),
    shouldRender: true,
    size: ownProps.size,
    style: ownProps.style,
  }
}

type WrapperProps = {|...ViewProps, shouldRender: true|} | {|shouldRender: false|}
const Wrapper = (props: WrapperProps) => {
  if (props.shouldRender) {
    const {shouldRender, ...passThroughProps} = props
    return <WalletsIconRender {...passThroughProps} />
  }
  return null
}

const WalletsIcon = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'WalletsIcon'
)(Wrapper)

export default WalletsIcon
