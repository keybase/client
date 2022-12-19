import type * as Types from '../../constants/types/people'
import {Box, ConnectedNameWithIcon, ScrollView, Text} from '../../common-adapters'
import * as Styles from '../../styles'

export type FollowSuggestion = Types.FollowSuggestion

export type Props = {
  suggestions: Array<FollowSuggestion>
}

const FollowSuggestions = (props: Props) => (
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
export default FollowSuggestions

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.fastBlank,
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
      backgroundColor: Styles.globalColors.fastBlank,
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
  text: {
    marginBottom: Styles.globalMargins.tiny,
    marginLeft: Styles.globalMargins.small,
  },
}))
