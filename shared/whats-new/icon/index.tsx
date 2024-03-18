import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {IconStyle} from '@/common-adapters/icon'
import {keybaseFM} from '@/constants/whats-new'
import Popup from './popup'
import './icon.css'

const positionFallbacks = ['bottom right', 'bottom center'] as const

type Props = {
  color?: string
  badgeColor?: string
  style?: IconStyle
  className?: string
  newRelease: boolean
  onClick?: () => void
}

type PopupProps = Props & {
  // Desktop only
  attachToRef: React.RefObject<Kb.MeasureRef>
}

// Forward the ref of the icon so we can attach the FloatingBox on desktop to this component
const Icon = (props: Props) => {
  const badgeSize = props.badgeColor ? 8 : 12
  const badgeSizeInner = badgeSize - 4

  return props.newRelease ? (
    Kb.Styles.isMobile ? (
      <Kb.Icon
        type="iconfont-nav-2-fm"
        onClick={props.onClick}
        color={Kb.Styles.globalColors.blue}
        style={Kb.Styles.collapseStyles([{marginRight: Kb.Styles.globalMargins.small}, props.style])}
      />
    ) : (
      <>
        <Kb.Icon
          type="iconfont-radio"
          style={styles.rainbowColor}
          className="rainbowGradient"
          onClick={props.onClick}
        />
        <Kb.Badge
          border={true}
          leftRightPadding={0}
          height={badgeSize}
          containerStyle={Kb.Styles.collapseStyles([
            styles.badgeContainerStyle,
            props.badgeColor ? styles.badgePositioningAlt : styles.badgePositioning,
          ])}
          badgeStyle={Kb.Styles.collapseStyles([
            styles.badgeStyles,
            props.badgeColor
              ? {
                  backgroundColor: props.badgeColor,
                  position: 'absolute',
                }
              : {
                  // Manually set the innerSize of the blue circle to have a larger white border
                  borderRadius: badgeSizeInner,
                  height: badgeSizeInner,
                  minWidth: badgeSizeInner,
                },
          ])}
        />
      </>
    )
  ) : Kb.Styles.isMobile ? (
    <Kb.Icon
      fontSize={24}
      type="iconfont-nav-2-fm"
      color={Kb.Styles.globalColors.black_50}
      style={Kb.Styles.collapseStyles([{marginRight: Kb.Styles.globalMargins.small}, props.style])}
    />
  ) : (
    // className will be hover_contained_color_$color so that should override the non-hover color set by the `color` prop.
    <Kb.Icon type="iconfont-radio" className={props.className} color={props.color} onClick={props.onClick} />
  )
}

export const IconWithPopup = React.memo(function IconWithPopup(props: PopupProps) {
  const {badgeColor, color, newRelease, attachToRef} = props
  const [popupVisible, setPopupVisible] = React.useState(false)
  const baseColor = Kb.Styles.globalColors.black_50
  const iconColor = color ? color : baseColor
  const popupVisibleColor = color || Kb.Styles.globalColors.black
  const onClick = React.useCallback(() => {
    popupVisible ? setPopupVisible(false) : !!attachToRef.current && setPopupVisible(true)
  }, [popupVisible, setPopupVisible, attachToRef])

  return (
    <>
      <Kb.Box style={styles.iconContainerMargins} onClick={onClick}>
        <Kb.Box2Measure
          direction="vertical"
          style={styles.iconContainer}
          tooltip={popupVisible ? undefined : keybaseFM}
          className={Kb.Styles.classNames(
            popupVisible
              ? ['background_color_black_10']
              : ['hover_container', 'hover_background_color_black_10'],
            'tooltip-bottom-left'
          )}
        >
          <Icon
            badgeColor={badgeColor}
            color={popupVisible ? popupVisibleColor : iconColor}
            className={Kb.Styles.classNames(
              color ? `hover_contained_color_${color}` : 'hover_contained_color_black'
            )}
            newRelease={newRelease}
          />
        </Kb.Box2Measure>
      </Kb.Box>
      {!Kb.Styles.isMobile && popupVisible && (
        <Popup
          attachTo={attachToRef}
          position="bottom right"
          positionFallbacks={positionFallbacks}
          onHidden={() => {
            setPopupVisible(false)
          }}
        />
      )}
    </>
  )
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  badgeContainerStyle: {
    position: 'absolute',
  },
  badgePositioning: {
    right: -1,
    top: 1,
  },
  badgePositioningAlt: {
    right: 1,
    top: 3,
  },
  badgeStyles: {
    backgroundColor: Kb.Styles.globalColors.blue,
  },
  iconContainer: Kb.Styles.platformStyles({
    common: {
      // Needed to position blue badge
      position: 'relative',
    },
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
      ...Kb.Styles.desktopStyles.windowDraggingClickable,
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      borderRadius: Kb.Styles.borderRadius,
      padding: Kb.Styles.globalMargins.xtiny,
    },
  }),
  // This exists so WithTooltip won't appear before the hover background is
  // shown since WithTooltip triggers on the total size including margins and
  // the hover background triggers on padding
  iconContainerMargins: {
    marginLeft: Kb.Styles.globalMargins.xtiny,
    marginRight: Kb.Styles.globalMargins.xtiny,
  },
  rainbowColor: Kb.Styles.platformStyles({
    isElectron: {
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      background:
        'linear-gradient(to top, #ff0000, rgba(255, 216, 0, 0.94) 19%, #27c400 40%, #0091ff 60%, #b000ff 80%, #ff0098)',
    },
  }),
}))
export default Icon
