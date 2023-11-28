import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'

const ProfileSearch = () => {
  const appendPeopleBuilder = C.useRouterState(s => s.appendPeopleBuilder)
  const onSearch = appendPeopleBuilder
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.SearchFilter
        hotkey="k"
        icon="iconfont-search"
        onFocus={Kb.Styles.isMobile ? undefined : onSearch}
        onClick={!Kb.Styles.isMobile ? undefined : onSearch}
        placeholderText={`Search${Kb.Styles.isMobile ? '' : ' people'}`}
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
      marginLeft: Kb.Styles.globalMargins.xsmall,
      marginRight: Kb.Styles.globalMargins.xsmall,
    },
    isMobile: {
      height: 40,
      paddingLeft: 0,
      paddingRight: 0,
    },
  }),
}))

export default ProfileSearch
