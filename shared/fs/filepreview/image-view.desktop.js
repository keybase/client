// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import {type ImageViewProps} from './image-view'

// NOTE that, unlike TextView, for ImageView we don't attempt to refresh token
// if what we have is invalid. This is because there's no way to know for sure
// an error (e.g. from `onError`) is a token error. Luckily, having an invalid
// token should not be a common case, esepcially that we are not expiring
// tokens intentionally on KBFS side. If in the future this becomes an issue,
// we might wanna just replace this with a webview.

const ImageView = (props: ImageViewProps) => (
  <Box style={stylesContainer}>
    <img src={props.url} draggable={false} style={stylesImage} />
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  width: '100%',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
}

const stylesImage = {
  maxHeight: '100%',
  maxWidth: '100%',
}

export default ImageView
