// @flow
import * as React from 'react'
import {ClickableBox, Box, Text, Badge} from '../../../../common-adapters'
import {
  styleSheetCreate,
  collapseStyles,
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
} from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  badgeCount: number,
  hiddenCount: number,
  style?: any,
  toggle: () => void,
}

class Divider extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={collapseStyles([styles.container, this.props.style])}>
        <ClickableBox onClick={this.props.toggle} className="toggleButtonClass" style={styles.toggleButton}>
          <Text type="BodySmallSemibold" style={styles.text}>
            {this.props.hiddenCount > 0 ? `+${this.props.hiddenCount} more` : 'Show less'}
          </Text>
          {this.props.hiddenCount > 0 &&
            this.props.badgeCount > 0 && (
              <Badge badgeStyle={styles.badgeToggle} badgeNumber={this.props.badgeCount} />
            )}
        </ClickableBox>
        <Box style={styles.divider} />
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  badge: {
    marginLeft: globalMargins.xtiny,
    marginRight: 0,
    position: 'relative',
  },
  badgeToggle: {
    marginLeft: globalMargins.xtiny,
    marginRight: 0,
    position: 'relative',
  },
  container: {
    ...globalStyles.flexBoxColumn,
    height: RowSizes.dividerHeight,
    justifyContent: 'center',
  },
  divider: {
    backgroundColor: globalColors.black_05,
    height: 1,
    width: '100%',
  },
  text: {
    color: globalColors.black_60,
  },
  toggleButton: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: globalColors.black_05,
    borderRadius: 19,
    height: isMobile ? 28 : 20,
    marginBottom: isMobile ? 16 : 8,
    paddingLeft: isMobile ? globalMargins.small : globalMargins.tiny,
    paddingRight: isMobile ? globalMargins.small : globalMargins.tiny,
  },
})

export {Divider}
