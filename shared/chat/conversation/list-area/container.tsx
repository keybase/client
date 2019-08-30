import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as ProfileGen from '../../../actions/profile-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import {getMeta} from '../../../constants/chat2'
import Normal from './normal/container'
import NewConv from './new-conv'
import {connect, isMobile} from '../../../util/container'
import flags from '../../../util/feature-flags'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
  onFocusInput: () => void
}

const NewConvSwitch = (props: {isEmpty: boolean} & React.PropsWithoutRef<typeof Normal>) => {
  let {isEmpty, ...normalProps} = props
  if (isEmpty && flags.wonderland) {
    return <NewConv />
  }
  return <Normal {...normalProps} />
}

export default connect(
  (s, {conversationIDKey}: OwnProps) => ({conversationIDKey, isEmpty: getMeta(s, conversationIDKey).isEmpty}),
  dispatch => ({
    onShowTracker: (username: string) =>
      isMobile
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  }),
  (stateProps, _, ownProps: OwnProps) => ({
    conversationIDKey: stateProps.conversationIDKey,
    isEmpty: stateProps.isEmpty,
    onFocusInput: ownProps.onFocusInput,
    scrollListDownCounter: ownProps.scrollListDownCounter,
    scrollListToBottomCounter: ownProps.scrollListToBottomCounter,
    scrollListUpCounter: ownProps.scrollListUpCounter,
  })
)(NewConvSwitch)
