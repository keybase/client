import React from 'react'
import Text from './text'
import Box from './box'
import FloatingMenu from './floating-menu'
import * as Styles from '../styles'
import ProfileCard from '../profile/card'

const Kb = {
  Box,
  FloatingMenu,
  Text,
}

export type OwnProps = {
  username: string
  theme?: 'follow' | 'nonFollow' | 'highlight' | 'none'
  style?: Styles.StylesCrossPlatform
  allowFontScaling?: boolean
}

export type Props = {
  onClick?: () => void
} & OwnProps

export default ({username, theme, style, allowFontScaling, onClick}: Props) => {
  const ref = React.useRef<Text>(null)
  const [showing, setShowing] = React.useState(false)
  const text = (
    <Kb.Text
      type="BodySemibold"
      onClick={onClick || undefined}
      className={Styles.classNames({'hover-underline': !Styles.isMobile})}
      style={Styles.collapseStyles([style, styles[theme || 'none'], styles.text])}
      allowFontScaling={allowFontScaling}
      onLongPress={() => setShowing(true)}
      ref={ref}
    >
      @{username}
    </Kb.Text>
  )
  const popup = showing && (
    <Kb.FloatingMenu
      attachTo={() => ref.current}
      closeOnSelect={true}
      onHidden={() => setShowing(false)}
      position="top center"
      propagateOutsideClicks={!Styles.isMobile}
      header={{
        title: '',
        view: <ProfileCard username={username} clickToProfile={true} />,
      }}
      items={[]}
      visible={showing}
    />
  )
  return Styles.isMobile ? (
    <>
      {text}
      {popup}
    </>
  ) : (
    <Kb.Box
      style={styles.textContainer}
      onMouseOver={() => setShowing(true)}
      onMouseLeave={() => setShowing(false)}
    >
      {text}
      {popup}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  follow: {
    backgroundColor: Styles.globalColors.greenOrGreenLighter,
    borderRadius: 2,
    color: Styles.globalColors.whiteOrGreenDark,
  },
  highlight: {
    backgroundColor: Styles.globalColors.yellowOrYellowLight,
    borderRadius: 2,
    color: Styles.globalColors.blackOrBlack,
  },
  nonFollow: {
    backgroundColor: Styles.globalColors.blueLighter2,
    borderRadius: 2,
    color: Styles.globalColors.blueDark,
  },
  none: {
    borderRadius: 2,
  },
  text: Styles.platformStyles({
    common: {
      letterSpacing: 0.3,
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
  textContainer: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
}))
