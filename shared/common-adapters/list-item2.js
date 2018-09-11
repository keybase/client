// @flow
import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import {Box2} from './box'
import Divider from './divider'

// List item following stylesheet specs. TODO deprecate list-item.*.js

type Props = {
  type: 'Small' | 'Large',
  icon: React.Node,
  body: React.Node,
  firstItem: boolean,
  action?: React.Node,
  onClick?: () => void,
}

const HoverBox = Styles.isMobile
  ? Box2
  : Styles.glamorous(Box2)({
      ':hover': {
        backgroundColor: Styles.globalColors.blue4,
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
      <Box2
        direction="horizontal"
        style={props.type === 'Small' ? styles.contentContainerSmall : styles.contentContainerLarge}
      >
        {!props.firstItem && <Divider style={styles.divider} />}
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

const smallHeight = Styles.isMobile ? 48 : 40
const largeHeight = Styles.isMobile ? 64 : 56
const smallIconWidth = Styles.isMobile ? 56 : 56
const largeIconWidth = Styles.isMobile ? 72 : 72

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
    width: '100%',
  },
  clickableBoxSmall: {
    flexShrink: 0,
    minHeight: smallHeight,
    width: '100%',
  },
  // Using margin and keeping the icon on the let using absolute is to work around an issue in RN where
  // the nested views won't grow and still retain their widths correctly
  contentContainerLarge: {
    flexGrow: 1,
    marginLeft: largeIconWidth,
    minHeight: largeHeight,
    position: 'relative',
  },
  contentContainerSmall: {
    flexGrow: 1,
    marginLeft: smallIconWidth,
    minHeight: smallHeight,
    position: 'relative',
  },
  divider: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconLarge: {
    position: 'absolute',
    width: Styles.isMobile ? 75 : 72,
  },
  iconSmall: {
    position: 'absolute',
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
})

export default ListItem
