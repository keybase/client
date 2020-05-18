import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {appendPeopleBuilder} from '../../actions/typed-routes'
import {useDispatch} from 'react-redux'

type Props = {
  style?: Styles.StylesCrossPlatform
  whiteText?: boolean
}

const ProfileSearch = (props: Props) => {
  const dispatch = useDispatch()
  const onSearch = React.useCallback(() => dispatch(appendPeopleBuilder()), [dispatch])
  const color = props.whiteText ? Styles.globalColors.white_75 : undefined
  return (
    <Kb.SearchFilter
      hotkey="k"
      icon="iconfont-search"
      iconColor={color}
      onChange={() => {}}
      onFocus={onSearch}
      placeholderColor={color}
      placeholderText={`Search${Styles.isMobile ? '' : ' people'}`}
      size="full-width"
      style={Styles.collapseStyles([Styles.isMobile ? styles.filterMobile : styles.filter, props.style])}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  filter: {
    marginLeft: Styles.globalMargins.xsmall,
    marginRight: Styles.globalMargins.xsmall,
  },
  filterMobile: {
    paddingLeft: 0,
    paddingRight: 0,
  },
}))

export default ProfileSearch
