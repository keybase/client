import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const ProfileSearch = () => {
  const appendPeopleBuilder = C.useRouterState(s => s.appendPeopleBuilder)
  const onSearch = appendPeopleBuilder
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.SearchFilter
        hotkey="k"
        icon="iconfont-search"
        onFocus={Styles.isMobile ? undefined : onSearch}
        onClick={!Styles.isMobile ? undefined : onSearch}
        placeholderText={`Search${Styles.isMobile ? '' : ' people'}`}
        size="full-width"
        style={styles.filter}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {width: '100%'},
    isMobile: {width: 215},
  }),
  filter: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.xsmall,
      marginRight: Styles.globalMargins.xsmall,
    },
    isMobile: {
      height: 40,
      paddingLeft: 0,
      paddingRight: 0,
    },
  }),
}))

export default ProfileSearch
