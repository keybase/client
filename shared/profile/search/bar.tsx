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
  return (
    <Kb.Box2 style={Styles.collapseStyles([styles.container, props.style])} direction="horizontal">
      <Kb.ClickableBox onClick={onSearch} style={Styles.collapseStyles([styles.searchContainer])}>
        <Kb.Box2 direction="horizontal" alignItems="center">
          <Kb.Icon
            color={props.whiteText ? Styles.globalColors.white_75 : Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 20 : 16}
            style={styles.searchIcon}
            type="iconfont-search"
          />
          <Kb.Text
            style={Styles.collapseStyles([styles.searchText, props.whiteText && styles.colorWhite])}
            type="BodySemibold"
          >
            Search{Styles.isMobile ? '' : ' people'}
          </Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}

const searchContainerHeight = 32
const styles = Styles.styleSheetCreate(() => ({
  colorWhite: {color: Styles.globalColors.white_75},
  container: {width: '100%'},
  searchContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      justifyContent: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
      ...Styles.desktopStyles.windowDraggingClickable,
      height: searchContainerHeight,
      justifyContent: 'flex-start',
      marginLeft: Styles.globalMargins.xsmall,
      marginRight: Styles.globalMargins.xsmall,
      marginTop: -Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.xsmall,
      width: '100%',
    },
    isMobile: {
      flexGrow: 1,
      padding: 4,
    },
  }),
  searchIcon: {paddingRight: Styles.globalMargins.tiny},
  searchText: {
    color: Styles.globalColors.black_50,
    maxWidth: 240,
  },
}))

export default ProfileSearch
