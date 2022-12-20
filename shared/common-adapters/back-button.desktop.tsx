import {createNavigateUp} from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'
import Text from './text'
import type {Props} from './back-button'

const Kb = {
  Icon,
  Text,
}

const BackButton = React.memo(function BackButton(props: Props) {
  const dispatch = Container.useDispatch()
  const onBack = props.disabled ? () => {} : props.onClick ?? (() => dispatch(createNavigateUp()))
  const _onClick = (event: React.BaseSyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onBack()
  }
  return (
    <div
      style={Styles.collapseStyles([
        props.disabled ? styles.disabledContainer : styles.container,
        props.style,
      ] as any)}
      onClick={_onClick}
    >
      <Kb.Icon
        type="iconfont-arrow-left"
        style={props.disabled ? styles.disabledIcon : styles.icon}
        color={props.iconColor}
      />
      {props.title !== null && !props.hideBackLabel && (
        <Kb.Text
          type={props.onClick ? 'BodyPrimaryLink' : 'Body'}
          style={Styles.collapseStyles([props.disabled && styles.disabledText, props.textStyle])}
          onClick={_onClick}
        >
          {props.title || 'Back'}
        </Kb.Text>
      )}
    </div>
  )
})

export const styles = {
  container: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.desktopStyles.clickable,
    alignItems: 'center',
    zIndex: 1,
  },
  disabledContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      cursor: 'default',
      zIndex: 1,
    },
  }),
  disabledIcon: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
      marginRight: 6,
    },
  }),
  disabledText: Styles.platformStyles({
    isElectron: {cursor: 'default'},
  }),
  icon: {
    marginRight: 6,
  },
} as const

export default BackButton
