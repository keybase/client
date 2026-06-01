import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2, ClickableBox} from './box'
import BoxGrow from './box-grow'
import Divider from './divider'
import './list-item.css'

const Kb = {
  Box2,
  BoxGrow,
  ClickableBox,
  Divider,
}

// List item following stylesheet specs. TODO deprecate list-item.*.js

type Props = {
  type: 'Small' | 'Large' | 'Card'
  icon?: React.ReactNode
  statusIcon?: React.ReactNode
  body: React.ReactNode
  firstItem: boolean
  fullDivider?: boolean
  action?: React.ReactNode
  hideHover?: boolean
  // If 'grow' is used, the width of action cannot exceed 64. If larger width
  // is needed, bump the `maxWidth: 64` below to a larger value. Note that if
  // it's too large, the animation would also seem much faster.
  onlyShowActionOnHover?: 'fade' | 'grow'
  onClick?: () => void
  onMouseDown?: (evt: React.BaseSyntheticEvent) => void // desktop only
  height?: number // optional, for non-standard heights
  style?: Styles.StylesCrossPlatform
  innerStyle?: Styles.StylesCrossPlatform
  iconStyleOverride?: Styles.StylesCrossPlatform
  containerStyleOverride?: Styles.StylesCrossPlatform
  testID?: string
}

const ListItem = (props: Props) => {
  if (props.type === 'Card') return <CardListItem {...props} />
  return (
  <Kb.ClickableBox
    onClick={props.onClick || (props.onMouseDown ? () => {} : undefined)} // make sure clickable box applies click styles if just onMouseDown is given.
    onMouseDown={props.onMouseDown}
    direction="horizontal"
    className={Styles.classNames({
      listItem2: !props.hideHover,
    })}
    style={Styles.collapseStyles([
      props.type === 'Small' ? styles.clickableBoxSmall : styles.clickableBoxLarge,
      !!props.height && {minHeight: props.height},
      props.style,
    ])}
    fullWidth={true}
    testID={props.testID}
  >
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([
        props.type === 'Small' ? styles.rowSmall : styles.rowLarge,
        !!props.height && {minHeight: props.height},
        props.innerStyle,
      ])}
      fullWidth={true}
    >
      {!props.firstItem && !!props.fullDivider && <Divider style={styles.divider} />}
      {props.statusIcon && (
        <Kb.Box2
          direction="vertical"
          style={getStatusIconStyle(props)}
          alignSelf="flex-start"
          alignItems="center"
          justifyContent="center"
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
      <Kb.Box2 direction="horizontal" style={getContainerStyles(props)}>
        {!props.firstItem && !props.fullDivider && <Divider style={styles.divider} />}
        <Kb.BoxGrow>
          <Kb.Box2 fullHeight={true} direction="horizontal" justifyContent="flex-start" flex={1} relative={true} style={styles.bodyContainer}>
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
          alignSelf="center"
        >
          {props.action}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
  )
}

export const smallHeight = isMobile ? 56 : 48
export const largeHeight = isMobile ? 64 : 56
const smallIconWidth = isMobile ? 64 : 64
const largeIconWidth = isMobile ? 72 : 72
const statusIconWidth = isMobile ? 48 : 44
const afterStatusIconItemLeftDistance = statusIconWidth - (isMobile ? 10 : 14)

const styles = Styles.styleSheetCreate(() => {
  const _styles = {
    actionContainer: {
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 0,
      justifyContent: 'flex-start',
      marginRight: 8,
      position: 'relative',
    } as const,
    bodyContainer: {
      alignItems: 'center',
      flexShrink: 1,
      maxWidth: '100%',
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
      width: largeIconWidth,
    } as const,
    iconSmall: {
      minHeight: smallHeight,
      width: smallIconWidth,
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
      left: afterStatusIconItemLeftDistance,
    },
    iconSmallWithNoStatusIcon: {
      ..._styles.icon,
      ..._styles.iconSmall,
    },
    iconSmallWithStatusIcon: {
      ..._styles.icon,
      ..._styles.iconSmall,
      left: afterStatusIconItemLeftDistance,
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
      marginLeft: afterStatusIconItemLeftDistance,
    },
    containerLargeWithStatusIconWithIcon: {
      ..._styles.contentContainer,
      ..._styles.heightLarge,
      marginLeft: largeIconWidth + afterStatusIconItemLeftDistance,
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
      marginLeft: afterStatusIconItemLeftDistance,
    },
    containerSmallWithStatusIconWithIcon: {
      ..._styles.contentContainer,
      ..._styles.heightSmall,
      marginLeft: smallIconWidth + afterStatusIconItemLeftDistance,
    },
  }

  const _actionStyles = {
    actionLargeIsGrowOnHover: {
      ..._styles.actionContainer,
      ..._styles.heightLarge,
      justifyContent: 'flex-end',
    } as const,
    actionLargeNotGrowOnHover: {
      ..._styles.actionContainer,
      ..._styles.heightLarge,
    } as const,
    actionSmallIsGrowOnHover: {
      ..._styles.actionContainer,
      ..._styles.heightSmall,
      justifyContent: 'flex-end',
    } as const,
    actionSmallNotGrowOnHover: {
      ..._styles.actionContainer,
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
  props.iconStyleOverride ??
  (props.type === 'Small'
    ? props.statusIcon
      ? styles.iconSmallWithStatusIcon
      : styles.iconSmallWithNoStatusIcon
    : props.statusIcon
      ? styles.iconLargeWithStatusIcon
      : styles.iconLargeWithNoStatusIcon)

const getContainerStyles = (props: Props) =>
  Styles.collapseStyles([
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
          : styles.containerLargeNoStatusIconNoIcon,
    // If this becomes a problem, memoize different heights we use.
    !!props.height && {minHeight: props.height},
    props.containerStyleOverride,
  ])

const getActionStyle = (props: Props) =>
  Styles.collapseStyles([
    props.type === 'Small'
      ? props.onlyShowActionOnHover
        ? styles.actionSmallIsGrowOnHover
        : styles.actionSmallNotGrowOnHover
      : props.onlyShowActionOnHover
        ? styles.actionLargeIsGrowOnHover
        : styles.actionLargeNotGrowOnHover,
    !!props.height && {minHeight: props.height},
  ])

const CardListItem = (props: Props) => (
  <Kb.ClickableBox
    onClick={props.onClick}
    direction="horizontal"
    alignItems="center"
    fullWidth={true}
    style={Styles.collapseStyles([cardStyles.card, props.style])}
  >
    {props.icon && <Kb.Box2 direction="vertical" style={cardStyles.icon}>{props.icon}</Kb.Box2>}
    <Kb.Box2 direction="vertical" flex={1} fullWidth={true}>{props.body}</Kb.Box2>
  </Kb.ClickableBox>
)

const cardStyles = Styles.styleSheetCreate(() => ({
  card: {
    ...Styles.border(Styles.globalColors.grey, 1, Styles.borderRadius),
    backgroundColor: Styles.globalColors.white,
    overflow: 'hidden',
    padding: Styles.globalMargins.small,
  },
  icon: {
    marginRight: Styles.globalMargins.small,
  },
}))

export default ListItem
