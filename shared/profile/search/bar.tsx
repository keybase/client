import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {appendPeopleBuilder} from '../../actions/typed-routes'
import {useDispatch} from 'react-redux'

const ProfileSearch = () => {
  const dispatch = useDispatch()
  const onSearch = React.useCallback(() => dispatch(appendPeopleBuilder()), [dispatch])
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
