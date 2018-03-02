// @flow
import * as React from 'react'
import {globalStyles, globalColors} from '../../styles'
import {Box} from '../../common-adapters'
import Download, {type DownloadProps} from './download'

type DownloadItem = {
  key: string,
} & DownloadProps

export type FooterProps = {
  downloads: Array<DownloadItem>,
}

const Footer = (props: FooterProps) =>
  props.downloads.length ? (
    <Box style={stylesBox}>
      {props.downloads.map(download => <Download {...download} key={download.key} />)}
    </Box>
  ) : null

const stylesBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-start',
  alignItems: 'center',
  height: 40,
  backgroundColor: globalColors.blue5,
  borderTopStyle: 'solid',
  borderTopWidth: 1,
  borderTopColor: globalColors.black_05,
}

export default Footer
