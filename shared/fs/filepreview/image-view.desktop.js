// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import {type ImageViewProps} from './image-view'

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
