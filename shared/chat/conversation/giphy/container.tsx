import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {namedConnect} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import GiphySearch from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {conversationIDKey} = ownProps
  const giphy = state.chat2.giphyResultMap.get(conversationIDKey, null)
  return {
    // Auto generated from flowToTs. Please clean me!
    galleryURL:
      // Auto generated from flowToTs. Please clean me!
      (giphy === null || giphy === undefined ? undefined : giphy.galleryUrl) !== null && // Auto generated from flowToTs. Please clean me!
      (giphy === null || giphy === undefined ? undefined : giphy.galleryUrl) !== undefined // Auto generated from flowToTs. Please clean me!
        ? giphy === null || giphy === undefined
          ? undefined
          : giphy.galleryUrl
        : '',
    // Auto generated from flowToTs. Please clean me!
    previews: giphy === null || giphy === undefined ? undefined : giphy.results,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  onClick: (url: string) => {
    dispatch(Chat2Gen.createGiphySend({conversationIDKey, url: new HiddenString(url)}))
  },
})

export default namedConnect(mapStateToProps, mapDispatchToProps, (s, d) => ({...s, ...d}), 'GiphySearch')(
  GiphySearch
)
