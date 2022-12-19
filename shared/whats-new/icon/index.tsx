import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {IconStyle} from '../../common-adapters/icon'
import {keybaseFM} from '../../constants/whats-new'
import Popup from '../popup'

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
  attachToRef: React.RefObject<Kb.Box2>
}

const realCSS = `
  .rainbowGradient {
    -webkit-background-clip: text !important;
  }
`
// Forward the ref of the icon so we can attach the FloatingBox on desktop to this component
const Icon = (props: Props) => {
  const badgeSize = props.badgeColor ? 8 : 12
  const badgeSizeInner = badgeSize - 4

  return props.newRelease ? (
    Styles.isMobile ? (
      <Kb.Icon
        type="iconfont-nav-2-fm"
        onClick={props.onClick}
        color={Styles.globalColors.blue}
        style={Styles.collapseStyles([{marginRight: Styles.globalMargins.small}, props.style])}
      />
    ) : (
      <>
        <Kb.DesktopStyle style={realCSS} />
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
          containerStyle={Styles.collapseStyles([
            styles.badgeContainerStyle,
            props.badgeColor ? styles.badgePositioningAlt : styles.badgePositioning,
          ])}
          badgeStyle={Styles.collapseStyles([
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
  ) : Styles.isMobile ? (
    <Kb.Icon
      fontSize={24}
      type="iconfont-nav-2-fm"
      color={Styles.globalColors.black_50}
      style={Styles.collapseStyles([{marginRight: Styles.globalMargins.small}, props.style])}
    />
  ) : (
    // className will be hover_contained_color_$color so that should override the non-hover color set by the `color` prop.
    <Kb.Icon type="iconfont-radio" className={props.className} color={props.color} onClick={props.onClick} />
  )
}

export const IconWithPopup = React.memo(function IconWithPopup(props: PopupProps) {
  const {badgeColor, color, newRelease, attachToRef} = props
  const [popupVisible, setPopupVisible] = React.useState(false)
  const baseColor = Styles.globalColors.black_50
  const iconColor = color ? color : baseColor
  const popupVisibleColor = color || Styles.globalColors.black
  return (
    <>
      <Kb.Box style={styles.iconContainerMargins}>
        <Kb.WithTooltip disabled={popupVisible} tooltip={keybaseFM} position="bottom center">
          <Kb.Box
            style={styles.iconContainer}
            className={Styles.classNames(
              popupVisible
                ? ['background_color_black_10']
                : ['hover_container', 'hover_background_color_black_10']
            )}
            onClick={() => {
              popupVisible ? setPopupVisible(false) : !!attachToRef && setPopupVisible(true)
            }}
          >
            <Icon
              badgeColor={badgeColor}
              color={popupVisible ? popupVisibleColor : iconColor}
              className={Styles.classNames(
                color ? `hover_contained_color_${color}` : 'hover_contained_color_black'
              )}
              newRelease={newRelease}
            />
          </Kb.Box>
        </Kb.WithTooltip>
      </Kb.Box>
      {!Styles.isMobile && popupVisible && (
        <Popup
          attachTo={() => attachToRef.current}
          position="bottom right"
          positionFallbacks={['bottom right', 'bottom center']}
          onHidden={() => {
            setPopupVisible(false)
          }}
        />
      )}
    </>
  )
})

const styles = Styles.styleSheetCreate(() => ({
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
    backgroundColor: Styles.globalColors.blue,
  },
  iconContainer: Styles.platformStyles({
    common: {
      // Needed to position blue badge
      position: 'relative',
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
      ...Styles.desktopStyles.windowDraggingClickable,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      borderRadius: Styles.borderRadius,
      padding: Styles.globalMargins.xtiny,
    },
  }),
  // This exists so WithTooltip won't appear before the hover background is
  // shown since WithTooltip triggers on the total size including margins and
  // the hover background triggers on padding
  iconContainerMargins: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
  },
  rainbowColor: Styles.platformStyles({
    isElectron: {
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      background:
        'linear-gradient(to top, #ff0000, rgba(255, 216, 0, 0.94) 19%, #27c400 40%, #0091ff 60%, #b000ff 80%, #ff0098)',
    },
  }),
}))
export default Icon
