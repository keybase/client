import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import GiphySearch from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey} = ownProps
    const giphy = state.chat2.giphyResultMap.get(conversationIDKey) ?? null
    return {
      galleryURL: giphy?.galleryUrl ?? '',
      previews: giphy?.results ?? null,
    }
  },
  (dispatch, {conversationIDKey}: OwnProps) => ({
    onClick: (url: string) => {
      dispatch(Chat2Gen.createGiphySend({conversationIDKey, url: new HiddenString(url)}))
    },
  }),
  (s, d) => ({...s, ...d}),
  'GiphySearch'
)(GiphySearch)
