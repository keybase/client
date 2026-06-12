import * as C from '@/constants'
import * as Kb from '@/common-adapters'

const ProfileSearch = () => {
  const appendPeopleBuilder = C.Router2.appendPeopleBuilder
  const onSearch = appendPeopleBuilder
  return (
    <Kb.SearchFilter
      hotkey="k"
      icon="iconfont-search"
      onFocus={isMobile ? undefined : onSearch}
      onClick={!isMobile ? undefined : onSearch}
      placeholderText={isMobile ? 'Search' : 'Search people'}
      size="full-width"
      style={styles.filter}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  filter: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.marginH(Kb.Styles.globalMargins.xsmall),
      alignSelf: 'center',
    },
    isMobile: {
      height: 40,
      ...Kb.Styles.paddingH(0),
      width: 215,
    },
  }),
}))

export default ProfileSearch
