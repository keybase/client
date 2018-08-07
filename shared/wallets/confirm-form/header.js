// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type HeaderProps = {|
  onBack: () => void,
  amount: string,
  assetType: string,
  assetConversion?: string,
|}

type HeaderState = {|
  coinOffset: ?Styles.StylesCrossPlatform,
|}

class Header extends React.Component<HeaderProps, HeaderState> {
  _headerContentRef = React.createRef()

  state = {
    coinOffset: undefined,
  }

  componentDidMount() {
    if (this._headerContentRef.current && this._headerContentRef.current.clientHeight <= 164) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        coinOffset: {
          position: 'relative',
          top: -20,
        },
      })
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
        <Kb.BackButton
          onClick={this.props.onBack}
          style={styles.backButton}
          iconColor={Styles.globalColors.white}
          textStyle={styles.backButtonText}
        />
        <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true} style={styles.headerContent}>
          <Kb.Icon
            type={
              Styles.isMobile ? 'icon-fancy-stellar-sending-desktop' : 'icon-fancy-stellar-sending-mobile'
            }
            style={Kb.iconCastPlatformStyles(styles.headerIcon)}
          />
          <Kb.Text type="BodySmall" style={styles.headerText}>
            Sending{!!this.props.assetConversion && ` ${this.props.assetType} worth`}
          </Kb.Text>
          <Kb.Text type="HeaderBigExtrabold" style={styles.headerText}>
            {this.props.assetConversion ? this.props.assetConversion : this.props.amount}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  header: Styles.platformStyles({
    isElectron: {
      minHeight: 144,
      flex: 1,
      backgroundColor: Styles.globalColors.purple,
    },
  }),
  headerContent: {
    marginTop: -20,
  },
  headerText: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      textTransform: 'uppercase',
    },
  }),
  headerIcon: {
    width: 100,
    marginBottom: Styles.globalMargins.small,
  },
  backButton: {
    position: 'absolute',
    top: Styles.globalMargins.small,
    left: Styles.globalMargins.small,
  },
  backButtonText: {
    color: Styles.globalColors.white,
  },
})

export default Header
