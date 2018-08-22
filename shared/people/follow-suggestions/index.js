// @flow
import * as React from 'react'
import * as Types from '../../constants/types/people'
import {Box, NameWithIcon, ScrollView, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles, styleSheetCreate} from '../../styles'
import {isMobile} from '../../constants/platform'

export type FollowSuggestion = Types.FollowSuggestion

export type Props = {
  suggestions: Array<FollowSuggestion>,
  onClickUser: (username: string) => void,
}

export default (props: Props) => (
  <Box style={styles.container}>
    <Text type="BodySmallSemibold" style={styles.text}>
      Consider following...
    </Text>
    <ScrollView
      {...(isMobile ? {horizontal: true, alwaysBounceHorizontal: false} : {})} // Causes error on desktop
      contentContainerStyle={styles.scrollViewContainer}
    >
      {props.suggestions.map(suggestion => (
        <NameWithIcon
          key={suggestion.username}
          username={suggestion.username}
          metaOne={suggestion.fullName}
          metaStyle={styles.meta}
          onClick={() => props.onClickUser(suggestion.username)}
          colorFollowing={true}
          size="small"
          containerStyle={styles.suggestionContainer}
        />
      ))}
    </ScrollView>
  </Box>
)

const styles = styleSheetCreate({
  container: {
    ...globalStyles.flexBoxColumn,
    paddingTop: globalMargins.tiny,
    position: 'relative',
  },
  meta: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  scrollViewContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      borderBottomWidth: 1,
      borderColor: globalColors.black_10,
    },
    isElectron: {
      borderBottomStyle: 'solid',
      flexWrap: 'wrap',
      height: 106,
      overflow: 'hidden',
      width: '100%',
    },
    isMobile: {
      paddingBottom: globalMargins.tiny,
    },
  }),
  suggestionContainer: {
    flexShrink: 0,
    height: 106,
    width: 112,
  },
  text: {
    marginBottom: globalMargins.tiny,
    marginLeft: globalMargins.tiny,
  },
})
