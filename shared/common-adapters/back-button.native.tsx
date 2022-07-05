import {createNavigateUp} from '../actions/route-tree-gen'
import * as React from 'react'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import * as Container from '../util/container'
import * as Styles from '../styles'
import {Props} from './back-button'

const Kb = {
  Badge,
  Box,
  Icon,
  NativeTouchableWithoutFeedback,
}

const BackButton = React.memo((props: Props) => {
  const dispatch = Container.useDispatch()
  const onBack = props.disabled ? () => {} : props.onClick ?? (() => dispatch(createNavigateUp()))
  return (
    <Kb.NativeTouchableWithoutFeedback
      onPress={(event: React.BaseSyntheticEvent) => {
        event && event.preventDefault && event.preventDefault()
        event && event.stopPropagation && event.stopPropagation()
        onBack()
      }}
    >
      <Kb.Box style={Styles.collapseStyles([styles.container, props.style])}>
        <Kb.Icon type="iconfont-arrow-left" color={props.iconColor} style={styles.arrow} />
        {!!props.badgeNumber && <Kb.Badge badgeNumber={props.badgeNumber} />}
      </Kb.Box>
    </Kb.NativeTouchableWithoutFeedback>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  arrow: {marginRight: -3, marginTop: 2},
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
