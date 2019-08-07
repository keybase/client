import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import {Box2} from './box'
import BoxGrow from './box-grow'
import Divider from './divider'
import './list-item2.css'

const Kb = {
  Box2,
  BoxGrow,
  ClickableBox,
  Divider,
}

// List item following stylesheet specs. TODO deprecate list-item.*.js

type Props = {
  type: 'Small' | 'Large'
  icon?: React.ReactNode
  statusIcon?: React.ReactNode
  body: React.ReactNode
  firstItem: boolean
  action?: React.ReactNode
  // If 'grow' is used, the width of action cannot exceed 64. If larger width
  // is needed, bump the `maxWidth: 64` below to a larger value. Note that if
  // it's too large, the animation would also seem much faster.
  onlyShowActionOnHover?: 'fade' | 'grow' | null
  onClick?: () => void
  height?: number // optional, for non-standard heights
}

const ListItem = (props: Props) => (
  <Kb.ClickableBox
    onClick={props.onClick}
    style={props.type === 'Small' ? styles.clickableBoxSmall : styles.clickableBoxLarge}
  >
    <Kb.Box2
      className="listItem2"
      direction="horizontal"
      style={props.type === 'Small' ? styles.rowSmall : styles.rowLarge}
      fullWidth={true}
    >
      {props.statusIcon && (
        <Kb.Box2
          direction="vertical"
          style={getStatusIconStyle(props)}
          alignSelf="flex-start"
          alignItems="flex-end"
        >
          {props.statusIcon}
        </Kb.Box2>
      )}
      {props.icon && (
        <Kb.Box2
          direction="vertical"
          style={getIconStyle(props)}
          centerChildren={true}
          alignSelf="flex-start"
        >
          {props.icon}
        </Kb.Box2>
      )}
      <Kb.Box2
        direction="horizontal"
        style={
          // If this becomes a problem, memoize different heights we use.
          props.height
            ? Styles.collapseStyles([getContainerStyles(props), {minHeight: props.height}])
            : getContainerStyles(props)
        }
      >
        {!props.firstItem && <Divider style={styles.divider} />}
        <Kb.BoxGrow>
          <Kb.Box2 fullHeight={true} direction="horizontal" style={styles.bodyContainer}>
            {props.body}
          </Kb.Box2>
        </Kb.BoxGrow>
        <Kb.Box2
          direction="horizontal"
          className={Styles.classNames({
            fade: props.onlyShowActionOnHover === 'fade',
            grow: props.onlyShowActionOnHover === 'grow',
          })}
          style={getActionStyle(props)}
          alignSelf="flex-start"
        >
          {props.action}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)

export const smallHeight = Styles.isMobile ? 56 : 48
export const largeHeight = Styles.isMobile ? 64 : 56
const smallIconWidth = Styles.isMobile ? 56 : 56
const largeIconWidth = Styles.isMobile ? 72 : 72
const statusIconWidth = Styles.isMobile ? 32 : 32

const styles = Styles.styleSheetCreate(() => {
  const _styles = {
    actionLargeContainer: {
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 0,
      justifyContent: 'flex-start',
      marginRight: 8,
      position: 'relative',
    } as const,
    actionSmallContainer: {
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 0,
      justifyContent: 'flex-start',
      marginRight: 8,
      position: 'relative',
    } as const,
    bodyContainer: {
      alignItems: 'center',
      flexGrow: 1,
      flexShrink: 1,
      justifyContent: 'flex-start',
      maxWidth: '100%',
      position: 'relative',
    } as const,
    clickableBoxLarge: {
      flexShrink: 0,
      minHeight: largeHeight,
      width: '100%',
    } as const,
    clickableBoxSmall: {
      flexShrink: 0,
      minHeight: smallHeight,
      width: '100%',
    } as const,
    contentContainer: {
      flexGrow: 1,
      position: 'relative',
    } as const,
    divider: {
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    } as const,
    heightLarge: {minHeight: largeHeight} as const,
    heightSmall: {minHeight: smallHeight} as const,
    icon: {
      position: 'absolute',
    } as const,
    iconLarge: {
      minHeight: largeHeight,
      width: Styles.isMobile ? 75 : 72,
    } as const,
    iconSmall: {
      minHeight: smallHeight,
      width: Styles.isMobile ? 60 : 56,
    } as const,
    rowLarge: {
      alignItems: 'center',
      minHeight: largeHeight,
      position: 'relative',
    } as const,
    rowSmall: {
      alignItems: 'center',
      minHeight: smallHeight,
      position: 'relative',
    } as const,
    statusIcon: {
      justifyContent: 'center',
      position: 'absolute',
      width: statusIconWidth,
    } as const,
  }

  const _statusIconStyles = {
    statusIconLarge: {
      ..._styles.statusIcon,
      ..._styles.heightLarge,
    },
    statusIconSmall: {
      ..._styles.statusIcon,
      ..._styles.heightSmall,
    },
  }

  const _iconStyles = {
    iconLargeWithNoStatusIcon: {
      ..._styles.icon,
      ..._styles.iconLarge,
    },
    iconLargeWithStatusIcon: {
      ..._styles.icon,
      ..._styles.iconLarge,
      left: statusIconWidth,
    },
    iconSmallWithNoStatusIcon: {
      ..._styles.icon,
      ..._styles.iconSmall,
    },
    iconSmallWithStatusIcon: {
      ..._styles.icon,
      ..._styles.iconSmall,
      left: statusIconWidth,
    },
  }

  // Using margin and keeping the icon on the let using absolute is to work around an issue in RN where
  // the nested views won't grow and still retain their widths correctly
  const _containerStyles = {
    containerLargeNoStatusIconNoIcon: {
      ..._styles.contentContainer,
      ..._styles.heightLarge,
      marginLeft: Styles.globalMargins.tiny,
    },
    containerLargeNoStatusIconWithIcon: {
      ..._styles.contentContainer,
      ..._styles.heightLarge,
      marginLeft: largeIconWidth,
    },
    containerLargeWithStatusIconNoIcon: {
      ..._styles.contentContainer,
      ..._styles.heightLarge,
      marginLeft: statusIconWidth,
    },
    containerLargeWithStatusIconWithIcon: {
      ..._styles.contentContainer,
      ..._styles.heightLarge,
      marginLeft: largeIconWidth + statusIconWidth,
    },
    containerSmallNoStatusIconNoIcon: {
      ..._styles.contentContainer,
      ..._styles.heightSmall,
      marginLeft: Styles.globalMargins.tiny,
    },
    containerSmallNoStatusIconWithIcon: {
      ..._styles.contentContainer,
      ..._styles.heightSmall,
      marginLeft: smallIconWidth,
    },
    containerSmallWithStatusIconNoIcon: {
      ..._styles.contentContainer,
      ..._styles.heightSmall,
      marginLeft: statusIconWidth,
    },
    containerSmallWithStatusIconWithIcon: {
      ..._styles.contentContainer,
      ..._styles.heightSmall,
      marginLeft: smallIconWidth + statusIconWidth,
    },
  }

  const _actionStyles = {
    actionLargeIsGrowOnHover: {
      ..._styles.actionLargeContainer,
      ..._styles.heightLarge,
      justifyContent: 'flex-end',
    } as const,
    actionLargeNotGrowOnHover: {
      ..._styles.actionLargeContainer,
      ..._styles.heightLarge,
    } as const,
    actionSmallIsGrowOnHover: {
      ..._styles.actionSmallContainer,
      ..._styles.heightSmall,
      justifyContent: 'flex-end',
    } as const,
    actionSmallNotGrowOnHover: {
      ..._styles.actionSmallContainer,
      ..._styles.heightSmall,
    } as const,
  }
  return {
    ..._styles,
    ..._statusIconStyles,
    ..._iconStyles,
    ..._containerStyles,
    ..._actionStyles,
  }
})

const getStatusIconStyle = (props: Props) =>
  props.type === 'Small' ? styles.statusIconSmall : styles.statusIconLarge

const getIconStyle = (props: Props) =>
  props.type === 'Small'
    ? props.statusIcon
      ? styles.iconSmallWithStatusIcon
      : styles.iconSmallWithNoStatusIcon
    : props.statusIcon
    ? styles.iconLargeWithStatusIcon
    : styles.iconLargeWithNoStatusIcon

const getContainerStyles = (props: Props) =>
  props.type === 'Small'
    ? props.statusIcon
      ? props.icon
        ? styles.containerSmallWithStatusIconWithIcon
        : styles.containerSmallWithStatusIconNoIcon
      : props.icon
      ? styles.containerSmallNoStatusIconWithIcon
      : styles.containerSmallNoStatusIconNoIcon
    : props.statusIcon
    ? props.icon
      ? styles.containerLargeWithStatusIconWithIcon
      : styles.containerLargeWithStatusIconNoIcon
    : props.icon
    ? styles.containerLargeNoStatusIconWithIcon
    : styles.containerLargeNoStatusIconNoIcon

const getActionStyle = (props: Props) =>
  props.type === 'Small'
    ? props.onlyShowActionOnHover
      ? styles.actionSmallIsGrowOnHover
      : styles.actionSmallNotGrowOnHover
    : props.onlyShowActionOnHover
    ? styles.actionLargeIsGrowOnHover
    : styles.actionLargeNotGrowOnHover

export default ListItem
