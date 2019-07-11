import * as React from 'react'
import {Props} from './standard-screen'
import {NativeScrollView} from './native-wrappers.native'
import HeaderHoc from './header-hoc'
import * as Styles from '../styles'
import {Banner, BannerParagraph} from './banner'
import Box from './box'
import Text from './text'

const Kb = {
  Banner,
  BannerParagraph,
  Box,
  NativeScrollView,
  Text,
}

const StandardScreen = (props: Props) => {
  const color = props.notification && props.notification.type === 'error' ? 'red' : 'blue'
  return (
    // @ts-ignore for now
    <Kb.NativeScrollView scrollEnabled={props.scrollEnabled}>
      {!!props.notification && (
        <Kb.Banner color={color}>
          <Kb.BannerParagraph bannerColor={color} content={props.notification.message} />
        </Kb.Banner>
      )}
      <Kb.Box
        style={Styles.collapseStyles([
          styles.content,
          !!props.notification && styles.contentMargin,
          props.style,
        ])}
      >
        {props.children}
      </Kb.Box>
    </Kb.NativeScrollView>
  )
}

const MIN_BANNER_HEIGHT = 40
const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.white,
    flexGrow: 1,
  },
  content: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  contentMargin: {marginTop: MIN_BANNER_HEIGHT},
})

export default HeaderHoc(StandardScreen)
