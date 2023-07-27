import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import GiphySearch from '.'

const GiphySearchContainer = React.memo(function GiphySearchContainer() {
  const giphy = Constants.useContext(s => s.giphyResult)
  const onClick = Constants.useContext(s => s.dispatch.giphySend)
  const props = {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
  return <GiphySearch {...props} />
})
export default GiphySearchContainer
