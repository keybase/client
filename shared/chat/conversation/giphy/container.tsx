import * as C from '../../../constants'
import * as React from 'react'
import GiphySearch from '.'

const GiphySearchContainer = React.memo(function GiphySearchContainer() {
  const giphy = C.useChatContext(s => s.giphyResult)
  const onClick = C.useChatContext(s => s.dispatch.giphySend)
  const props = {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
  return <GiphySearch {...props} />
})
export default GiphySearchContainer
