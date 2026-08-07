import * as C from '@/constants'
import * as Kb from '@/common-adapters'

const ProfileSearch = () => {
  const styles = useStyles()
  const appendPeopleBuilder = C.Router2.appendPeopleBuilder
  return (
    <Kb.SearchFilter
      hotkey="k"
      icon="iconfont-search"
      onClick={appendPeopleBuilder}
      placeholderText={isMobile ? 'Search' : 'Search people'}
      size="full-width"
      style={styles.filter}
    />
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
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
