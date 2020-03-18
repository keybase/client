import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import GiphySearch from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => ({}),
  (dispatch, {conversationIDKey}: OwnProps) => ({
    onStartedVideoChat: (offer: string) => {
      dispatch(Chat2Gen.createStartedVideoChat({conversationIDKey, offer: new HiddenString(offer)}))
    },
  }),
  (s, d) => ({...s, ...d}),
  'GiphySearch'
)(GiphySearch)
