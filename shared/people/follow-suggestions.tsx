import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

export type FollowSuggestion = T.People.FollowSuggestion

export type Props = {
  suggestions: ReadonlyArray<FollowSuggestion>
}

const FollowSuggestions = (props: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.Text type="BodySmallSemibold" style={styles.text}>
      Consider following...
    </Kb.Text>
    <Kb.ScrollView
      {...(Kb.Styles.isMobile ? {alwaysBounceHorizontal: false, horizontal: true} : {})} // Causes error on desktop
      contentContainerStyle={styles.scrollViewContainer}
    >
      {props.suggestions.map(suggestion => (
        <Kb.ConnectedNameWithIcon
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
    </Kb.ScrollView>
  </Kb.Box>
)
export default FollowSuggestions

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    backgroundColor: Kb.Styles.globalColors.fastBlank,
    paddingTop: Kb.Styles.globalMargins.tiny,
    position: 'relative',
  },
  meta: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  scrollViewContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      backgroundColor: Kb.Styles.globalColors.fastBlank,
      borderBottomWidth: 1,
      borderColor: Kb.Styles.globalColors.black_10,
      paddingBottom: Kb.Styles.globalMargins.small,
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
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginLeft: Kb.Styles.globalMargins.small,
  },
}))
