// @flow
import * as React from 'react'
import {ClickableBox, Box2, Text, Badge} from '../../../../common-adapters'
import {
  styleSheetCreate,
  platformStyles,
  collapseStyles,
  globalStyles,
  globalColors,
  globalMargins,
} from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  badgeCount: number,
  hiddenCount: number,
  style?: any,
  showButton: boolean,
  toggle: () => void,
}

class Divider extends React.PureComponent<Props> {
  render() {
    return (
      <Box2
        direction="vertical"
        style={collapseStyles([
          this.props.showButton ? styles.containerButton : styles.containerNoButton,
          this.props.style,
        ])}
        gap="tiny"
        gapStart={true}
        gapEnd={true}
      >
        {this.props.showButton && (
          <ClickableBox onClick={this.props.toggle} style={styles.containerToggleButton}>
            <Box2 direction="horizontal" className="toggleButtonClass" style={styles.toggleButton}>
              <Text type="BodySmallSemibold" style={styles.buttonText}>
                {this.props.hiddenCount > 0 ? `+${this.props.hiddenCount} more` : 'Show less'}
              </Text>
              {this.props.hiddenCount > 0 &&
                this.props.badgeCount > 0 && (
                  <Badge badgeStyle={styles.badgeToggle} badgeNumber={this.props.badgeCount} />
                )}
            </Box2>
          </ClickableBox>
        )}
        <Box2 direction="vertical" style={styles.divider} />
        {!this.props.showButton && (
          <Text type="BodySmallSemibold" style={styles.dividerText}>
            Big teams
          </Text>
        )}
      </Box2>
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
  buttonText: {color: globalColors.black_60},
  containerButton: {
    ...globalStyles.flexBoxColumn,
    height: RowSizes.dividerHeight(true),
    justifyContent: 'center',
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
    width: '100%',
  },
  containerNoButton: {
    ...globalStyles.flexBoxColumn,
    height: RowSizes.dividerHeight(false),
    justifyContent: 'center',
    width: '100%',
  },
  containerToggleButton: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  divider: {
    backgroundColor: globalColors.black_05,
    height: 1,
    width: '100%',
  },
  dividerText: {
    alignSelf: 'flex-start',
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
  },
  toggleButton: platformStyles({
    common: {
      backgroundColor: globalColors.black_05,
      borderRadius: 19,
      marginBottom: globalMargins.xtiny,
      marginTop: globalMargins.xtiny,
      paddingBottom: globalMargins.xtiny,
      paddingTop: globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: globalMargins.tiny,
      marginRight: globalMargins.tiny,

      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    },
    isMobile: {
      marginLeft: globalMargins.small,
      marginRight: globalMargins.small,

      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    },
  }),
})

export {Divider}
