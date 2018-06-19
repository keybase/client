// @flow
import * as React from 'react'
import {globalStyles, globalColors} from '../../styles'
import {Box} from '../../common-adapters'
import Download from './download-container'

export type FooterProps = {
  downloadKeys: Array<string>,
}

const Footer = (props: FooterProps) =>
  !!props.downloadKeys.length && (
    <Box style={stylesBox}>{props.downloadKeys.map(key => <Download downloadKey={key} key={key} />)}</Box>
  )

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
