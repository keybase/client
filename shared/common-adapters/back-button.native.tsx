import * as C from '@/constants'
import {Pressable, Keyboard} from 'react-native'
import Badge from './badge'
import {Box2} from './box'
import Icon from './icon'
import * as Styles from '@/styles'
import type {Props} from './back-button'
import noop from 'lodash/noop'

const Kb = {
  Badge,
  Box2,
  Icon,
}

function BackButton(props: Props) {
  const navigateUp = C.Router2.navigateUp
  const onNavUp = () => {
    // this helps with some timing issues w/ dismissing keyboard avoiding views
    Keyboard.dismiss()
    navigateUp()
  }
  const onBack = props.disabled ? noop : (props.onClick ?? onNavUp)
  return (
    <Pressable onPress={onBack} testID="backButton">
      <Kb.Box2 direction="horizontal" alignItems="center" style={Styles.collapseStyles([styles.container, props.style])}>
        <Kb.Icon
          type="iconfont-arrow-left"
          color={props.iconColor}
          style={styles.arrow}
        />
        {!!props.badgeNumber && <Kb.Badge badgeNumber={props.badgeNumber} />}
      </Kb.Box2>
    </Pressable>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  arrow: {
    marginRight: -3,
    marginTop: 2,
  },
  container: {
    marginRight: 8,
    minWidth: 32,
    padding: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.small,
  },
}))

export default BackButton
