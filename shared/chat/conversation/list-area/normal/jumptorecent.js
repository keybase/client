// @flow

import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {|
  onClick: () => void,
  style?: Styles.StylesCrossPlatform,
|}

const JumpToRecent = (props: Props) => {
  return (
    <Kb.ClickableBox
      onClick={props.onClick}
      style={Styles.collapseStyles([styles.outerContainer, props.style])}
    >
      <Kb.Box2 direction="horizontal" style={styles.container}>
        <Kb.Text type="Body" style={styles.text}>
          <Kb.Icon
            type="iconfont-arrow-full-down"
            boxStyle={styles.arrowBox}
            fontSize={12}
            style={Kb.iconCastPlatformStyles(styles.arrowText)}
          />{' '}
          Jump to recent messages
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate({
  arrowBox: Styles.platformStyles({
    isElectron: {
      display: 'inline',
    },
  }),
  arrowText: {
    color: Styles.globalColors.white,
  },
  container: {
    backgroundColor: Styles.globalColors.blue,
    borderRadius: 28,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  outerContainer: {
    marginBottom: Styles.globalMargins.tiny,
    width: '100%',
  },
  text: {
    color: Styles.globalColors.white,
  },
})

export default JumpToRecent
