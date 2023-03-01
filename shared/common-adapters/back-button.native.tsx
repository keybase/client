import {createNavigateUp} from '../actions/route-tree-gen'
import * as React from 'react'
import {TouchableWithoutFeedback, Keyboard} from 'react-native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import * as Container from '../util/container'
import * as Styles from '../styles'
import type {Props} from './back-button'
import noop from 'lodash/noop'

const Kb = {
  Badge,
  Box,
  Icon,
}

const BackButton = React.memo(function BackButton(props: Props) {
  const canFixOverdraw = React.useContext(Styles.CanFixOverdrawContext)
  const dispatch = Container.useDispatch()
  const onNavUp = React.useCallback(() => {
    // this helps with some timing issues w/ dismissing keyboard avoiding views
    Keyboard.dismiss()
    dispatch(createNavigateUp())
  }, [dispatch])
  const onBack = props.disabled ? noop : props.onClick ?? onNavUp
  return (
    <TouchableWithoutFeedback
      onPress={(event: React.BaseSyntheticEvent) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        onBack()
      }}
    >
      <Kb.Box style={Styles.collapseStyles([styles.container, props.style])}>
        <Kb.Icon
          fixOverdraw={canFixOverdraw}
          type="iconfont-arrow-left"
          color={props.iconColor}
          style={styles.arrow}
        />
        {!!props.badgeNumber && <Kb.Badge badgeNumber={props.badgeNumber} />}
      </Kb.Box>
    </TouchableWithoutFeedback>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  arrow: {
    marginRight: -3,
    marginTop: 2,
  },
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginRight: 8,
    minWidth: 32,
    padding: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.small,
  },
}))

export default BackButton
