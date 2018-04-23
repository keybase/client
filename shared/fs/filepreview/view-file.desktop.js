// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import type {FilePreviewProps} from './common'

// TODO: pass real URLs here from the http server.
const renderFileTypeSpecial = (props: FilePreviewProps) => {
  switch (Types.getNameExtension(props.pathItem.name).toLowerCase()) {
    case 'txt':
      return <webview src={'https://keybase.io/warp/release.txt'} />
    case 'jpg':
    case 'png':
    case 'gif':
      return <webview src={'https://keybase.io/images/icons/icon-keybase-logo-48.png'} />
  }
  return null
}

export default renderFileTypeSpecial
