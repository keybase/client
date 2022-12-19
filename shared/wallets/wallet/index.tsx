import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/wallets'
import AccountReloader from '../common/account-reloader'
import Asset from '../asset/container'
import Transaction from '../transaction/container'

const stripePatternSize = Styles.isMobile ? 18 : 9

export type Props = {
  acceptedDisclaimer: boolean
  accountID: Types.AccountID
  loadError: string
  loadingMore: boolean
  onBack: () => void
  onLoadMore: () => void
  onMarkAsRead: () => void
  sections: Array<{data: any; title: string | React.ReactNode; kind: string; stripeHeader?: boolean}>
}

const HistoryPlaceholder = () => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.historyPlaceholder}>
    <Kb.Text type="BodySmall" style={styles.historyPlaceholderText}>
      You don’t have any history with this account.
    </Kb.Text>
  </Kb.Box2>
)

export const AssetSectionTitle = (props: {onSetupTrustline: () => void; thisDeviceIsLockedOut: boolean}) => (
  <Kb.Text type="BodySmallSemibold">
    Your assets
    {!props.thisDeviceIsLockedOut && (
      <Kb.Text type="BodySmallSemibold">
        &nbsp;(
        <Kb.Text
          className="hover-underline"
          onClick={props.onSetupTrustline}
          style={styles.clickable}
          type="BodySmallSemibold"
        >
          Manage
        </Kb.Text>
        )
      </Kb.Text>
    )}
  </Kb.Text>
)

class Wallet extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (prevProps.accountID !== this.props.accountID) {
      prevProps.onMarkAsRead()
    }
  }

  componentWillUnmount() {
    this.props.onMarkAsRead()
  }

  _renderItem = ({item, index, section}) => {
    const children: Array<React.ReactNode> = []
    if (item === 'notLoadedYet') {
      children.push(
        <Kb.Box2
          key="notLoadedYet"
          direction="horizontal"
          fullWidth={true}
          style={styles.loadingBox}
          gap="tiny"
          gapStart={true}
        >
          <Kb.ProgressIndicator key="spinner" style={styles.spinner} type="Small" />
          <Kb.Text type="BodySmall">Loading {section.kind}...</Kb.Text>
        </Kb.Box2>
      )
    } else if (item === 'noPayments') {
      children.push(<HistoryPlaceholder key="placeholder" />)
    } else if (section.title === 'History' || section.title === 'Pending') {
      children.push(
        <Transaction
          accountID={this.props.accountID}
          paymentID={item.paymentID}
          key={`${this.props.accountID}:${item.paymentID}`}
        />
      )
    } else {
      children.push(
        <Asset accountID={this.props.accountID} index={item} key={`${this.props.accountID}:${item}`} />
      )
    }
    if (index !== section.data.length - 1) {
      // don't put divider after last thing in section
      children.push(<Kb.Divider key={`${this.props.accountID}:${item}:divider`} />)
    }
    // TODO
    return children
  }

  _keyExtractor = (item, index) => {
    if (typeof item === 'string') {
      return item
    }
    if (item.paymentID) {
      return item.paymentID
    }
    return index
  }

  _renderSectionHeader = ({section}) => {
    const stripePatternName = Styles.isMobile
      ? Styles.isDarkMode()
        ? require('../../images/icons/dark-pattern-stripes-blue-5-black-5-mobile.png')
        : require('../../images/icons/pattern-stripes-blue-5-black-5-mobile.png')
      : Styles.isDarkMode()
      ? 'dark-pattern-stripes-blue-5-black-5-desktop.png'
      : 'pattern-stripes-blue-5-black-5-desktop.png'

    return section.stripeHeader ? (
      <Kb.BackgroundRepeatBox
        imageHeight={stripePatternSize}
        imageName={stripePatternName}
        imageWidth={stripePatternSize}
        skipBackground={false}
        style={styles.sectionHeader}
      >
        <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
      </Kb.BackgroundRepeatBox>
    ) : (
      <Kb.SectionDivider label={section.title} />
    )
  }

  _onEndReached = () => {
    // React native's SectionList seems to call the onEndReached method twice each time it hits the end of the list
    // so only dispatch the action if we aren't already waiting for more data
    if (!this.props.loadingMore) {
      this.props.onLoadMore()
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" style={{flexGrow: 1}} fullHeight={true}>
        {!!this.props.loadError && <Kb.Banner color="yellow">{this.props.loadError}</Kb.Banner>}
        <Kb.SectionList
          sections={this.props.sections}
          renderItem={this._renderItem}
          renderSectionHeader={this._renderSectionHeader}
          stickySectionHeadersEnabled={false}
          keyExtractor={this._keyExtractor}
          onEndReached={this._onEndReached}
        />
        {this.props.loadingMore && <Kb.ProgressIndicator style={styles.loadingMore} />}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      clickable: Styles.platformStyles({
        isElectron: {...Styles.desktopStyles.clickable},
      }),
      historyPlaceholder: {
        marginTop: 36,
      },
      historyPlaceholderText: {
        color: Styles.globalColors.black_50,
      },
      loadingBox: {
        alignItems: 'center',
        justifyContent: 'flex-start',
      },
      loadingMore: {
        bottom: 10,
        height: 20,
        position: 'absolute',
        right: 10,
        width: 20,
      },
      sectionHeader: {
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.blueLighter3,
        paddingBottom: Styles.globalMargins.xtiny,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.xtiny,
        paddingTop: Styles.globalMargins.xtiny,
        width: '100%',
      },
      spinner: {
        height: 46,
        padding: Styles.globalMargins.tiny,
        width: 46,
      },
    } as const)
)

// If we're on mobile, this is the entry point, so we need to wrap
// with AccountReloader.
const MaybeReloaderWallet = (props: Props) => {
  const wallet = <Wallet {...props} />
  return Styles.isPhone ? <AccountReloader onBack={props.onBack}>{wallet}</AccountReloader> : wallet
}

export default MaybeReloaderWallet
