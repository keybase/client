import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {IconStyle} from '../../common-adapters/icon'
import {keybaseFM} from '../../constants/whats-new'
import Popup from '../popup.desktop'

type Props = {
  newRelease: boolean
  color?: string
  badgeColor?: string
  className?: string
  style?: IconStyle
  onClick?: () => void
}

type PopupProps = Props & {
  // Desktop only
  updateAvailable: boolean
  // Desktop only
  attachToRef: React.RefObject<Kb.Box2>
}

// Clips the rainbow background around the icon
const realCSS = `
  .rainbowGradient {
    -webkit-background-clip: text !important;
  }
`
// Forward the ref of the icon so we can attach the FloatingBox on desktop to this component
const Icon = (props: Props) => {
  const badgeSize = props.badgeColor ? 8 : 12
  const badgeSizeInner = badgeSize - 4

  if (Styles.isMobile) {
    const colorMobile = props.newRelease ? Styles.globalColors.blue : Styles.globalColors.black_20
    return (
      <Kb.Icon
        type="iconfont-radio"
        onClick={props.onClick}
        color={colorMobile}
        style={Styles.collapseStyles([{marginRight: Styles.globalMargins.small}, props.style])}
      />
    )
  }
  return props.newRelease ? (
    <>
      <Kb.DesktopStyle style={realCSS} />
      <Kb.Icon
        type="iconfont-radio"
        style={Styles.collapseStyles([styles.rainbowColor, props.style])}
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
  ) : (
    // className will be hover_contained_color_$color so that should override the non-hover color set by the `color` prop.
    <Kb.Icon
      type="iconfont-radio"
      className={props.className}
      color={props.color}
      style={props.style}
      onClick={props.onClick}
    />
  )
}

export const IconWithPopup = (props: PopupProps) => {
  const {badgeColor, color, newRelease, updateAvailable, attachToRef} = props
  const [popupVisible, setPopupVisible] = React.useState(false)
  const baseColor = Styles.globalColors.black_50
  const iconColor = color ? color : baseColor
  const iconHoverColor = color ? color : Styles.globalColors.black
  const popupVisibleColor = color || Styles.globalColors.black
  const popupVisibleBackgroundColor = updateAvailable
    ? ['background_color_greenLighter']
    : popupVisible
    ? ['background_color_black_10']
    : ['hover_container', 'hover_background_color_black_10']
  return (
    <>
      <Kb.Box style={styles.iconContainerMargins}>
        <Kb.WithTooltip disabled={popupVisible} tooltip={keybaseFM} position="bottom center">
          <Kb.Box
            style={styles.iconContainer}
            className={Styles.classNames(popupVisibleBackgroundColor)}
            onClick={() => {
              popupVisible ? setPopupVisible(false) : !!attachToRef && setPopupVisible(true)
            }}
          >
            {updateAvailable ? (
              <Kb.Box2 direction="horizontal">
                <Icon
                  color={Styles.globalColors.greenDark}
                  className={`hover_contained_color_${Styles.globalColors.greenDark}`}
                  newRelease={false}
                  style={styles.updateAvailable}
                />
                <Kb.Text type="BodySmallSuccess">Update available</Kb.Text>
              </Kb.Box2>
            ) : (
              <Icon
                badgeColor={badgeColor}
                color={popupVisible ? popupVisibleColor : iconColor}
                className={iconHoverColor}
                newRelease={newRelease}
              />
            )}
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
}

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
  updateAvailable: {
    marginRight: Styles.globalMargins.xtiny,
  },
}))
export default Icon
