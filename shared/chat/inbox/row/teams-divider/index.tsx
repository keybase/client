import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  badgeCount: number
  hiddenCount: number
  style: Styles.StylesCrossPlatform | null
  showButton: boolean
  toggle: () => void
}

class TeamsDivider extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([
          this.props.showButton ? styles.containerButton : styles.containerNoButton,
          this.props.style,
        ])}
        gap="tiny"
        gapStart={true}
        gapEnd={true}
      >
        {this.props.showButton && (
          <Kb.ClickableBox onClick={this.props.toggle} style={styles.containerToggleButton}>
            <Kb.Box2 direction="horizontal" className="toggleButtonClass" style={styles.toggleButton}>
              <Kb.Text type="BodySmallSemibold" style={styles.buttonText}>
                {this.props.hiddenCount > 0 ? `+${this.props.hiddenCount} more` : 'Show less'}
              </Kb.Text>
              {this.props.hiddenCount > 0 && this.props.badgeCount > 0 && (
                <Kb.Badge badgeStyle={styles.badge} badgeNumber={this.props.badgeCount} />
              )}
            </Kb.Box2>
          </Kb.ClickableBox>
        )}
        {!this.props.showButton && (
          <Kb.Text type="BodySmallSemibold" style={styles.dividerText}>
            Big teams
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  badge: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: 0,
  },
  buttonText: {color: Styles.globalColors.black_50},
  containerButton: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      flexShrink: 0,
      height: RowSizes.dividerHeight(true),
      justifyContent: 'center',
      width: '100%',
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  containerNoButton: {
    ...Styles.globalStyles.flexBoxColumn,
    flexShrink: 0,
    height: RowSizes.dividerHeight(false),
    justifyContent: 'center',
    width: '100%',
  },
  containerToggleButton: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  dividerText: {
    alignSelf: 'flex-start',
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,

      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,

      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
})

export {TeamsDivider}
