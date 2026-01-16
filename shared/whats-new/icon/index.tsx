import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {IconStyle} from '@/common-adapters/icon'
import {keybaseFM} from '@/stores/whats-new'
import Popup from './popup'
import './icon.css'
import {useWhatsNewState as useWNState} from '@/stores/whats-new'

type OwnProps = {
  color?: string
  badgeColor?: string
  style?: IconStyle
}

type PopupOwnProps = OwnProps & {
  attachToRef: React.RefObject<Kb.MeasureRef | null>
}

// Just Whats New Icon connected for badge state
const IconContainer = (p: OwnProps) => {
  const {badgeColor, style, color} = p
  const newRelease = useWNState(s => s.anyVersionsUnseen())
  return <Icon badgeColor={badgeColor} color={color} newRelease={newRelease} style={style} />
}

// Whats New icon with popup which is connected to the badge state and marking release as seen.
export const IconWithPopupDesktop = (p: PopupOwnProps) => {
  const {badgeColor, color} = p
  const newRelease = useWNState(s => s.anyVersionsUnseen())

  const baseColor = Kb.Styles.globalColors.black_50
  const iconColor = color ? color : baseColor

  const makePopup = React.useCallback((p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return !Kb.Styles.isMobile ? (
      <Popup
        attachTo={attachTo}
        position="bottom right"
        positionFallbacks={positionFallbacks}
        onHidden={hidePopup}
      />
    ) : null
  }, [])
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  const popupVisibleColor = color || Kb.Styles.globalColors.black
  return (
    <>
      <Kb.Box style={styles.iconContainerMargins} onClick={showPopup}>
        <Kb.Box2Measure
          ref={popupAnchor}
          direction="vertical"
          style={styles.iconContainer}
          tooltip={popup ? undefined : keybaseFM}
          className={Kb.Styles.classNames(
            popup ? ['background_color_black_10'] : ['hover_container', 'hover_background_color_black_10'],
            'tooltip-bottom-left'
          )}
        >
          <Icon
            badgeColor={badgeColor}
            color={popup ? popupVisibleColor : iconColor}
            className={Kb.Styles.classNames(
              color ? `hover_contained_color_${color}` : 'hover_contained_color_black'
            )}
            newRelease={newRelease}
          />
        </Kb.Box2Measure>
      </Kb.Box>
      {popup}
    </>
  )
}

const positionFallbacks = ['bottom right', 'bottom center'] as const

type Props = {
  color?: string
  badgeColor?: string
  style?: IconStyle
  className?: string
  newRelease: boolean
  onClick?: () => void
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badgeContainerStyle: {position: 'absolute'},
      badgePositioning: {
        right: -1,
        top: 1,
      },
      badgePositioningAlt: {
        right: 1,
        top: 3,
      },
      badgeStyles: {backgroundColor: Kb.Styles.globalColors.blue},
      iconContainer: Kb.Styles.platformStyles({
        // Needed to position blue badge
        common: {position: 'relative'},
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
    }) as const
)

export default IconContainer
