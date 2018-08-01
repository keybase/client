// @flow
import * as React from 'react'
import ClickableBox from './clickable-box'
import {Box2} from './box'
import {globalColors, styleSheetCreate, glamorous, isMobile} from '../styles'

// List item following stylesheet specs. TODO deprecate list-item.*.js

type Props = {
  type: 'Small' | 'Large',
  icon: React.Node,
  body: React.Node,
  firstItem: boolean,
  action?: React.Node,
  onClick?: () => void,
}

const HoverBox = isMobile
  ? Box2
  : glamorous(Box2)({
      ':hover': {
        backgroundColor: globalColors.blue4,
      },
    })

const ListItem = (props: Props) => (
  <ClickableBox
    onClick={props.onClick}
    style={props.type === 'Small' ? styles.clickableBoxSmall : styles.clickableBoxLarge}
  >
    <HoverBox
      direction="horizontal"
      style={props.type === 'Small' ? styles.rowSmall : styles.rowLarge}
      fullWidth={true}
    >
      <Box2
        direction="vertical"
        style={props.type === 'Small' ? styles.iconSmall : styles.iconLarge}
        centerChildren={true}
      >
        {props.icon}
      </Box2>
      <Box2 direction="horizontal" style={styles.contentContainer}>
        {!props.firstItem && <Box2 direction="vertical" fullWidth={true} style={styles.divider} />}
        <Box2
          direction="horizontal"
          style={props.type === 'Small' ? styles.bodySmallContainer : styles.bodyLargeContainer}
        >
          {props.body}
        </Box2>
        <Box2
          direction="horizontal"
          style={props.type === 'Small' ? styles.actionSmallContainer : styles.actionLargeContainer}
        >
          {props.action}
        </Box2>
      </Box2>
    </HoverBox>
  </ClickableBox>
)

const smallHeight = isMobile ? 48 : 40
const largeHeight = isMobile ? 64 : 56

const styles = styleSheetCreate({
  actionLargeContainer: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
    minHeight: largeHeight,
    position: 'relative',
  },
  actionSmallContainer: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
    minHeight: smallHeight,
    position: 'relative',
  },
  bodyLargeContainer: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'flex-start',
    minHeight: largeHeight,
    position: 'relative',
  },
  bodySmallContainer: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'flex-start',
    minHeight: smallHeight,
    position: 'relative',
  },
  clickableBoxLarge: {
    flexShrink: 0,
    minHeight: largeHeight,
  },
  clickableBoxSmall: {
    flexShrink: 0,
    minHeight: smallHeight,
  },
  contentContainer: {
    flexGrow: 1,
    position: 'relative',
  },
  divider: {
    backgroundColor: globalColors.black_05,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconLarge: {flexGrow: 0, flexShrink: 0, width: isMobile ? 75 : 72},
  iconSmall: {flexGrow: 0, flexShrink: 0, width: isMobile ? 60 : 56},
  rowLarge: {
    alignItems: 'center',
    minHeight: largeHeight,
  },
  rowSmall: {
    alignItems: 'center',
    minHeight: smallHeight,
  },
})

export default ListItem
