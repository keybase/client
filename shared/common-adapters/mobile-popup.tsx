import * as React from 'react'
import * as Styles from '../styles'
import FloatingBox from './floating-box'
import {Box2} from './box'
import {KeyboardAvoidingView2} from './keyboard-avoiding-view'
import {windowHeight} from '../constants/platform'

const Kb = {
  Box2,
  FloatingBox,
  KeyboardAvoidingView2,
}

type Props = {
  children: React.ReactNode
  overlayStyle?: Styles.StylesCrossPlatform
}

const MobilePopup = (props: Props) => (
  <Kb.FloatingBox>
    <Kb.KeyboardAvoidingView2>
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.underlay}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([styles.overlay, props.overlayStyle])}
        >
          {props.children}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.KeyboardAvoidingView2>
  </Kb.FloatingBox>
)

const styles = Styles.styleSheetCreate(() => ({
  overlay: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      maxHeight: 0.8 * windowHeight,
    },
    isTablet: {
      maxWidth: 460,
    },
  }),
  underlay: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.padding(27, Styles.globalMargins.small, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.black_50OrBlack_50,
  },
}))

export default MobilePopup
