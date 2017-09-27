// @flow
import * as React from 'react'
import {Box, ScrollView} from '../../common-adapters'
import {globalStyles} from '../../styles'
import Header from './header'
import Banner from './banner'
import BetaNote from './beta-note'
import TeamList from './team-list'

import type {Props as HeaderProps} from './header'
import type {Props as BannerProps} from './banner'
import type {Props as BetaNoteProps} from './beta-note'
import type {Props as TeamListProps} from './team-list'

type Props = HeaderProps & BetaNoteProps & TeamListProps & BannerProps & {sawChatBanner: boolean}

const Teams = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
    <Header {...props} />
    <Box style={{flex: 1, position: 'relative', width: '100%'}}>
      <ScrollView
        style={globalStyles.fillAbsolute}
        contentContainerStyle={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
        }}
      >
        {!props.sawChatBanner && <Banner onReadMore={props.onReadMore} onHideBanner={props.onHideBanner} />}
        <TeamList {...props} />
        <BetaNote {...props} />
      </ScrollView>
    </Box>
  </Box>
)

export default Teams
