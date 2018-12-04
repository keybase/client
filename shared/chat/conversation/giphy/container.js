// @flow
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {namedConnect} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import GiphySearch from '.'

type OwnProps = {|conversationIDKey: Types.ConversationIDKey|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {conversationIDKey} = ownProps
  const previews = (state.chat2.giphyResultMap.getIn([conversationIDKey]) || []).map(r => {
    return {
      targetUrl: r.targetUrl,
      previewUrl: r.previewUrl,
      previewWidth: r.previewWidth,
      previewHeight: r.previewHeight,
      previewIsVideo: r.previewIsVideo,
    }
  })
  return {
    previews,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  onClick: (url: string) => {
    dispatch(Chat2Gen.createMessageSend({conversationIDKey, text: new HiddenString(url)}))
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'GiphySearch'
)(GiphySearch)
