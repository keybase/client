// @flow
import * as React from 'react'
import {Box2} from './box'
import Button from './button'
import Text from './text'
import Icon from './icon'
import {
  collapseStyles,
  type StylesCrossPlatform,
  globalColors,
  globalStyles,
  isMobile,
  styleSheetCreate,
} from '../styles'

type Props = {
  containerStyle?: StylesCrossPlatform,
  text: string,
}

class CopyText extends React.Component<Props> {
  render() {
    return (
      <Box2 direction="horizontal" style={collapseStyles([styles.container, this.props.containerStyle])}>
        <Text type="Body" selectable={true} style={styles.text}>
          {this.props.text}
        </Text>
        <Button type="Primary" style={styles.button} onClick={() => {}}>
          <Icon type="iconfont-clipboard" color={globalColors.white} />
        </Button>
      </Box2>
    )
  }
}

// border radii aren't literally so big, just sets it to max
// TODO vertical align text center on native
const styles = styleSheetCreate({
  button: {
    height: '100%',
    paddingLeft: 17,
    paddingRight: 17,
    position: 'absolute',
    right: -20,
  },
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.blue4,
    borderBottomLeftRadius: 100,
    borderTopLeftRadius: 100,
    flex: 1,
    paddingBottom: 6,
    paddingLeft: 16,
    paddingTop: 6,
    position: 'relative',
  },
  text: {
    ...globalStyles.fontTerminalSemibold,
    color: globalColors.blue,
    fontSize: isMobile ? 15 : 13,
    userSelect: 'all',
    width: '100%',
  },
})

export default CopyText
