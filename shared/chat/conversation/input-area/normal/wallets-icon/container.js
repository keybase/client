// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Constants from '../../../../../constants/chat2'
import WalletsIconRender, {type WalletsIconProps as ViewProps} from '.'

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
  if (stateProps._meta.teamType !== 'adhoc' || stateProps._meta.participants.size !== 2) {
    // Only show this for one-on-one conversations
    return renderNothingProps
  }
  const to = stateProps._meta.participants.find(u => u !== stateProps._you)
  if (!to) {
    return renderNothingProps
  }
  return {
    isNew: stateProps.isNew,
    onSend: () => dispatchProps._onClick(to, stateProps.isNew, false),
    onRequest: () => dispatchProps._onClick(to, stateProps.isNew, true),
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

const WalletsIcon = Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'WalletsIcon')(
  Wrapper
)

export default WalletsIcon
