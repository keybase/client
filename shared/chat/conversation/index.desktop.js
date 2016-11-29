// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'
import Header from './header.desktop'
import List from './list.desktop'
import Input from './input.desktop'
import Banner from './banner'

import type {Props} from '.'
import type {Props as BannerMessage} from './banner'

const Conversation = (props: Props) => {
  const bannerMessage: ?BannerMessage = props.bannerMessage
  // $FlowIssue with variants
  const banner = bannerMessage && <Banner {...bannerMessage} />
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Header {...props} />
      <List {...props} />
      {banner}
      <Input {...props} />
    </Box>
  )
}

export default Conversation
