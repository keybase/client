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
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginBottom: globalMargins.medium,
  marginTop: globalMargins.medium,
  width: '100%',
}

const stylesImage = {
  maxHeight: '100%',
  maxWidth: '100%',
}

export default ImageView
