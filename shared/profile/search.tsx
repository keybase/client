import * as C from '@/constants'
import * as Kb from '@/common-adapters'

const ProfileSearch = () => {
  const appendPeopleBuilder = C.Router2.appendPeopleBuilder
  const onSearch = appendPeopleBuilder
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.SearchFilter
        hotkey="k"
        icon="iconfont-search"
        onFocus={isMobile ? undefined : onSearch}
        onClick={!isMobile ? undefined : onSearch}
        placeholderText={isMobile ? 'Search' : 'Search people'}
        size="full-width"
        style={styles.filter}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    isElectron: {width: '100%'},
    isMobile: {width: 215},
  }),
  filter: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.marginH(Kb.Styles.globalMargins.xsmall),
    },
    isMobile: {
      height: 40,
      ...Kb.Styles.paddingH(0),
    },
  }),
}))

export default ProfileSearch
