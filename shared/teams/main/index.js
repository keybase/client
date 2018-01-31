// @flow
import * as React from 'react'
import {Box, ProgressIndicator, ScrollView} from '../../common-adapters'
import {globalMargins, globalStyles, isMobile} from '../../styles'
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
        {!props.sawChatBanner && (
          <Banner onReadMore={props.onReadMore} onHideChatBanner={props.onHideChatBanner} />
        )}
        <TeamList {...props} />
        <BetaNote {...props} />
        {/* Put progress indicator in the footer on mobile because it won't fit in the header on small screens */}
        {isMobile && (
          <ProgressIndicator
            style={{
              alignSelf: 'center',
              marginBottom: globalMargins.small,
              opacity: props.loaded ? 0 : 1,
              width: 20,
            }}
          />
        )}
      </ScrollView>
    </Box>
  </Box>
)

export default Teams
