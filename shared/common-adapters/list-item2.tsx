import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import {Box2} from './box'
import BoxGrow from './box-grow'
import Divider from './divider'

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

const HoverBox = Styles.isMobile
  ? Box2
  : Styles.styled(Box2)({
      // @ts-ignore
      '.fade': {
        opacity: 0,
        ...Styles.transition('opacity'),
      },
      '.grow': {
        maxWidth: 0,
        overflow: 'hidden',
        ...Styles.transition('max-width'),
      },
      ':hover': {
        backgroundColor: Styles.globalColors.blueLighter2,
      },
      ':hover .avatar-border': {
        // TODO: it'd be nice to move this out of this file since list-item2
        // has nothing todo with avatars. We'd need Kb.AvatarLine to know
        // about different background and set that on hover though.
        boxShadow: `0px 0px 0px 2px ${Styles.globalColors.blueLighter2} !important`,
      },
      ':hover .fade': {
        opacity: 1,
      },
      ':hover .grow': {
        maxWidth: 64,
      },
    })

const ListItem = (props: Props) => (
  <Kb.ClickableBox
    onClick={props.onClick}
    style={props.type === 'Small' ? styles.clickableBoxSmall : styles.clickableBoxLarge}
  >
    <HoverBox
      direction="horizontal"
      style={props.type === 'Small' ? styles.rowSmall : styles.rowLarge}
      fullWidth={true}
    >
      {props.statusIcon && (
        <Kb.Box2
          direction="vertical"
          style={statusIconStyles[props.type === 'Small' ? 'small' : 'large']}
          alignSelf="flex-start"
          alignItems="flex-end"
        >
          {props.statusIcon}
        </Kb.Box2>
      )}
      {props.icon && (
        <Kb.Box2
          direction="vertical"
          style={
            iconStyles[props.type === 'Small' ? 'small' : 'large'][
              props.statusIcon ? 'withStatusIcon' : 'noStatusIcon'
            ]
          }
          centerChildren={true}
          alignSelf="flex-start"
        >
          {props.icon}
        </Kb.Box2>
      )}
      <Kb.Box2 direction="horizontal" style={getContainerStyles(props)}>
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
          style={
            actionStyles[props.type === 'Small' ? 'small' : 'large'][
              props.onlyShowActionOnHover === 'grow' ? 'isGrowOnHover' : 'notGrowOnHover'
            ]
          }
          alignSelf="flex-start"
        >
          {props.action}
        </Kb.Box2>
      </Kb.Box2>
    </HoverBox>
  </Kb.ClickableBox>
)

export const smallHeight = Styles.isMobile ? 56 : 48
export const largeHeight = Styles.isMobile ? 64 : 56
const smallIconWidth = Styles.isMobile ? 56 : 56
const largeIconWidth = Styles.isMobile ? 72 : 72
const statusIconWidth = Styles.isMobile ? 32 : 32
const styles = Styles.styleSheetCreate({
  actionLargeContainer: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
    marginRight: 8,
    position: 'relative',
  },
  actionSmallContainer: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
    marginRight: 8,
    position: 'relative',
  },
  bodyContainer: {
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'flex-start',
    maxWidth: '100%',
    position: 'relative',
  },
  clickableBoxLarge: {
    flexShrink: 0,
    minHeight: largeHeight,
    width: '100%',
  },
  clickableBoxSmall: {
    flexShrink: 0,
    minHeight: smallHeight,
    width: '100%',
  },
  contentContainer: {
    flexGrow: 1,
    position: 'relative',
  },
  divider: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heightLarge: {minHeight: largeHeight},
  heightSmall: {minHeight: smallHeight},
  icon: {
    position: 'absolute',
  },
  iconLarge: {
    minHeight: largeHeight,
    width: Styles.isMobile ? 75 : 72,
  },
  iconSmall: {
    minHeight: smallHeight,
    width: Styles.isMobile ? 60 : 56,
  },
  rowLarge: {
    alignItems: 'center',
    minHeight: largeHeight,
    position: 'relative',
  },
  rowSmall: {
    alignItems: 'center',
    minHeight: smallHeight,
    position: 'relative',
  },
  statusIcon: {
    justifyContent: 'center',
    position: 'absolute',
    width: statusIconWidth,
  },
})

const statusIconStyles = {
  large: Styles.collapseStyles([styles.statusIcon, styles.heightLarge]),
  small: Styles.collapseStyles([styles.statusIcon, styles.heightSmall]),
}

const iconStyles = {
  large: {
    noStatusIcon: Styles.collapseStyles([styles.icon, styles.iconLarge]),
    withStatusIcon: Styles.collapseStyles([styles.icon, styles.iconLarge, {left: statusIconWidth}]),
  },
  small: {
    noStatusIcon: Styles.collapseStyles([styles.icon, styles.iconSmall]),
    withStatusIcon: Styles.collapseStyles([styles.icon, styles.iconSmall, {left: statusIconWidth}]),
  },
}

// Using margin and keeping the icon on the let using absolute is to work around an issue in RN where
// the nested views won't grow and still retain their widths correctly
const containerStyles = {
  large: {
    noStatusIcon: {
      noIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightLarge,
        {marginLeft: Styles.globalMargins.tiny},
      ]),
      withIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightLarge,
        {marginLeft: largeIconWidth},
      ]),
    },
    withStatusIcon: {
      NoIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightLarge,
        {marginLeft: statusIconWidth},
      ]),
      withIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightLarge,
        {marginLeft: largeIconWidth + statusIconWidth},
      ]),
    },
  },
  small: {
    noStatusIcon: {
      noIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightSmall,
        {marginLeft: Styles.globalMargins.tiny},
      ]),
      withIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightSmall,
        {marginLeft: smallIconWidth},
      ]),
    },
    withStatusIcon: {
      noIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightSmall,
        {marginLeft: statusIconWidth},
      ]),
      withIcon: Styles.collapseStyles([
        styles.contentContainer,
        styles.heightSmall,
        {marginLeft: smallIconWidth + statusIconWidth},
      ]),
    },
  },
}

const getContainerStyles = (props: Props) => {
  const beforeHeight =
    containerStyles[props.type === 'Small' ? 'small' : 'large'][
      props.statusIcon ? 'withStatusIcon' : 'noStatusIcon'
    ][props.icon ? 'withIcon' : 'noIcon']
  // If this becomes a problem, memoize different heights we use.
  return props.height ? Styles.collapseStyles([beforeHeight, {minHeight: props.height}]) : beforeHeight
}

const actionStyles = {
  large: {
    isGrowOnHover: Styles.collapseStyles([
      styles.actionLargeContainer,
      {
        // This provides the correct behavior for grow where the actions show up
        // and the content slides left from on top of the actions.
        justifyContent: 'flex-end',
      },
      styles.heightLarge,
    ]),
    notGrowOnHover: Styles.collapseStyles([styles.actionLargeContainer, styles.heightLarge]),
  },
  small: {
    isGrowOnHover: Styles.collapseStyles([
      styles.actionSmallContainer,
      {
        // This provides the correct behavior for grow where the actions show up
        // and the content slides left from on top of the actions.
        justifyContent: 'flex-end',
      },
      styles.heightSmall,
    ]),
    notGrowOnHover: Styles.collapseStyles([styles.actionSmallContainer, styles.heightSmall]),
  },
}

export default ListItem
