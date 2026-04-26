import * as React from 'react'
import {Box2} from '../box'
import FloatingBox from './floating-box'
import Icon from '../icon'
import {EscapeHandler} from '../key-event-handler.desktop'
import * as Styles from '@/styles'
import type {PopupProps} from '.'

const Kb = {
  Box2,
  EscapeHandler,
  FloatingBox,
  Icon,
}

function stopBubbling(ev: React.MouseEvent<HTMLDivElement>) {
  ev.stopPropagation()
}

function PopupPositioned(props: PopupProps) {
  if (Object.hasOwn(props, 'visible') && !props.visible) {
    return null
  }
  return (
    <Kb.FloatingBox
      matchDimension={!!props.matchDimension}
      {...(props.attachTo === undefined ? {} : {attachTo: props.attachTo})}
      {...(props.containerStyle === undefined ? {} : {containerStyle: props.containerStyle})}
      {...(props.onHidden === undefined ? {} : {onHidden: props.onHidden})}
      {...(props.remeasureHint === undefined ? {} : {remeasureHint: props.remeasureHint})}
      {...(props.position === undefined ? {} : {position: props.position})}
      {...(props.positionFallbacks === undefined ? {} : {positionFallbacks: props.positionFallbacks})}
      {...(props.propagateOutsideClicks === undefined ? {} : {propagateOutsideClicks: props.propagateOutsideClicks})}
      {...(props.offset === undefined ? {} : {offset: props.offset})}
    >
      {props.onHidden ? (
        <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.positioned, props.style])}>
          {props.children}
        </Kb.Box2>
      ) : (
        props.children
      )}
    </Kb.FloatingBox>
  )
}

function PopupCentered(props: PopupProps) {
  const [mouseDownOnCover, setMouseDownOnCover] = React.useState(false)
  return (
    <Kb.EscapeHandler onESC={props.onHidden ?? (() => {})}>
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.cover, props.style])}
        onMouseUp={() => {
          if (mouseDownOnCover) {
            props.onHidden?.()
          }
        }}
        onMouseDown={() => {
          setMouseDownOnCover(true)
        }}
      >
        <Kb.Box2
          direction="vertical"
          style={styles.centeredContainer}
          onMouseDown={(e: React.BaseSyntheticEvent) => {
            setMouseDownOnCover(false)
            e.stopPropagation()
          }}
          onMouseUp={(e: React.BaseSyntheticEvent) => e.stopPropagation()}
        >
          <div
            style={styles.clipContainer as React.CSSProperties}
            onClick={stopBubbling}
          >
            {props.children}
          </div>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.EscapeHandler>
  )
}

function Popup(props: PopupProps) {
  if (props.attachTo) {
    return <PopupPositioned {...props} />
  }
  return <PopupCentered {...props} />
}

const styles = Styles.styleSheetCreate(() => ({
  centeredContainer: {
    ...Styles.globalStyles.flexBoxRow,
    maxHeight: '100%',
    maxWidth: '100%',
    position: 'relative' as const,
  },
  clipContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      flex: 1,
      maxWidth: '100%',
      position: 'relative',
    },
  }),
  cover: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.fillAbsolute,
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingBottom: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.large,
  },
  positioned: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: 3,
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
}))

export default Popup
