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

// Using margin and keeping the icon on the let using absolute is to work around an issue in RN where
// the nested views won't grow and still retain their widths correctly
const iconLeftStyle = (props: Props) => (props.statusIcon ? {left: statusIconWidth} : null)
const containerLeftStyle = (props: Props) => {
  const left =
    (props.statusIcon ? statusIconWidth : 0) +
    (props.icon ? (props.type === 'Small' ? smallIconWidth : largeIconWidth) : 0)
  return left ? {marginLeft: left} : styles.tinyMarginLeft
}

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
          style={Styles.collapseStyles([
            styles.statusIcon,
            props.type === 'Small' && styles.heightSmall,
            props.type === 'Large' && styles.heightLarge,
          ])}
          alignSelf="flex-start"
          alignItems="flex-end"
        >
          {props.statusIcon}
        </Kb.Box2>
      )}
      {props.icon && (
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([
            styles.icon,
            props.type === 'Small' && styles.iconSmall,
            props.type === 'Large' && styles.iconLarge,
            iconLeftStyle(props),
          ])}
          centerChildren={true}
          alignSelf="flex-start"
        >
          {props.icon}
        </Kb.Box2>
      )}
      <Kb.Box2
        direction="horizontal"
        style={Styles.collapseStyles([
          styles.contentContainer,
          props.type === 'Small' && styles.heightSmall,
          props.type === 'Large' && styles.heightLarge,
          containerLeftStyle(props),
          !!props.height && {minHeight: props.height},
        ])}
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
          style={Styles.collapseStyles([
            props.type === 'Small' ? styles.actionSmallContainer : styles.actionLargeContainer,
            props.onlyShowActionOnHover === 'grow' && styles.actionFlexEnd,
            props.type === 'Small' && styles.heightSmall,
            props.type === 'Large' && styles.heightLarge,
          ])}
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
  actionFlexEnd: {
    // This provides the correct behavior for grow where the actions show up
    // and the content slides left from on top of the actions.
    justifyContent: 'flex-end',
  },
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
  tinyMarginLeft: {marginLeft: Styles.globalMargins.tiny},
})

export default ListItem
