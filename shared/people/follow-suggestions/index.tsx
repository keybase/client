import * as React from 'react'
import * as Types from '../../constants/types/people'
import {Box, ConnectedNameWithIcon, ScrollView, Text} from '../../common-adapters'
import * as Styles from '../../styles'

export type FollowSuggestion = Types.FollowSuggestion

export type Props = {
  suggestions: Array<FollowSuggestion>
}

export default (props: Props) => (
  <Box style={styles.container}>
    <Text type="BodySmallSemibold" style={styles.text}>
      Consider following...
    </Text>
    <ScrollView
      {...(Styles.isMobile ? {alwaysBounceHorizontal: false, horizontal: true} : {})} // Causes error on desktop
      contentContainerStyle={styles.scrollViewContainer}
    >
      {props.suggestions.map(suggestion => (
        <ConnectedNameWithIcon
          key={suggestion.username}
          username={suggestion.username}
          metaOne={suggestion.fullName}
          metaStyle={styles.meta}
          onClick="profile"
          colorFollowing={true}
          size="small"
          containerStyle={styles.suggestionContainer}
        />
      ))}
    </ScrollView>
  </Box>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    paddingTop: Styles.globalMargins.tiny,
    position: 'relative',
  },
  meta: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  scrollViewContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      borderBottomWidth: 1,
      borderColor: Styles.globalColors.black_10,
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      borderBottomStyle: 'solid',
      flexWrap: 'wrap',
      height: 112,
      overflow: 'hidden',
      width: '100%',
    },
  }),
  suggestionContainer: {
    flexShrink: 0,
    height: 112,
    width: 112,
  },
  text: Styles.platformStyles({
    common: {marginBottom: Styles.globalMargins.tiny},
    isElectron: {marginLeft: Styles.globalMargins.small},
    isMobile: {marginLeft: Styles.globalMargins.tiny},
  }),
}))
