// @flow
import * as React from 'react'
import * as Types from '../../constants/types/people'
import {Box, NameWithIcon, ScrollView, Text} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

export type FollowSuggestion = Types._FollowSuggestion

export type Props = {
  suggestions: Array<FollowSuggestion>,
  onClickUser: (username: string) => void,
}

export default (props: Props) => (
  <Box style={containerStyle}>
    <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.tiny, marginLeft: globalMargins.tiny}}>
      Consider following...
    </Text>
    <ScrollView
      {...(isMobile ? {horizontal: true, alwaysBounceHorizontal: false} : {})} // Causes error on desktop
      contentContainerStyle={scrollViewContainerStyle}
    >
      {props.suggestions.map(suggestion => (
        <NameWithIcon
          key={suggestion.username}
          username={suggestion.username}
          metaOne={suggestion.fullName}
          metaStyle={{paddingLeft: 2, paddingRight: 2}}
          onClick={() => props.onClickUser(suggestion.username)}
          colorFollowing={true}
          size="small"
          containerStyle={suggestionContainerStyle}
        />
      ))}
    </ScrollView>
  </Box>
)

const suggestionContainerStyle = {
  flexShrink: 0,
  width: 112,
  height: 106,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
}

const scrollViewContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? null
    : {...globalStyles.flexBoxRow, width: '100%', height: 106, flexWrap: 'wrap', overflow: 'hidden'}),
}
