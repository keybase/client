// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Constants from '../../../../../constants/chat2'
import * as WalletConstants from '../../../../../constants/wallets'
import WalletsIconRender, {type WalletsIconProps as ViewProps} from '.'

const mapStateToProps = state => ({
  _meta: Constants.getMeta(state, Constants.getSelectedConversation(state)),
  _you: state.config.username,
  isNew: state.chat2.isWalletsNew,
})

const mapDispatchToProps = dispatch => ({
  _onClick: (to: string, wasNew: boolean) => {
    if (wasNew) {
      dispatch(Chat2Gen.createHandleSeeingWallets())
    }
    dispatch(WalletsGen.createAbandonPayment())
    dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'keybaseUser'}))
    dispatch(WalletsGen.createSetBuildingTo({to}))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {isRequest: true},
            selected: WalletConstants.sendReceiveFormRouteKey,
          },
        ],
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
  if (!to || to.indexOf('@') !== -1) {
    // Send to SBS assertion not currently supported in the GUI
    return renderNothingProps
  }
  return {
    isNew: stateProps.isNew,
    onClick: () => dispatchProps._onClick(to, stateProps.isNew),
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

const WalletsIcon = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.setDisplayName('WalletsIcon')
)(Wrapper)

export default WalletsIcon
