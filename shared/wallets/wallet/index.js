// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import Header from './header/container'
import Asset from '../asset/container'
import Transaction from '../transaction/container'

const stripePatternName = Styles.isMobile
  ? require('../../images/icons/pattern-stripes-blue-5-black-5-mobile.png')
  : 'pattern-stripes-blue-5-black-5-desktop.png'
const stripePatternSize = Styles.isMobile ? 18 : 9

export type Props = {
  acceptedDisclaimer: boolean,
  accountID: Types.AccountID,
  loadingMore: boolean,
  navigateAppend: (...Array<any>) => any,
  navigateUp: () => any,
  onLoadMore: () => void,
  onMarkAsRead: () => void,
  sections: any[],
  refresh: () => void,
}

const HistoryPlaceholder = () => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.historyPlaceholder}>
    <Kb.Text type="BodySmall" style={styles.historyPlaceholderText}>
      You don’t have any history with this account.
    </Kb.Text>
  </Kb.Box2>
)

class Wallet extends React.Component<Props> {
  componentDidMount() {
    // If we're on mobile, this is the entry point, so we need to
    // refresh.
    if (Styles.isMobile) {
      this.props.refresh()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.accountID !== this.props.accountID) {
      prevProps.onMarkAsRead()
    }
  }

  componentWillUnmount() {
    this.props.onMarkAsRead()
  }

  _renderItem = ({item, index, section}) => {
    const children = []
    if (item === 'notLoadedYet') {
      children.push(
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.loadingBox} gap="tiny" gapStart={true}>
          <Kb.ProgressIndicator key="spinner" style={styles.spinner} type="Small" />
          <Kb.Text type="BodySmall">
            {section.title === 'Your assets' ? 'Loading assets...' : 'Loading payments...'}
          </Kb.Text>
        </Kb.Box2>
      )
    } else if (item === 'noPayments') {
      children.push(<HistoryPlaceholder key="placeholder" />)
    } else if (section.title === 'Your assets') {
      children.push(
        <Asset accountID={this.props.accountID} index={item} key={`${this.props.accountID}:${item}`} />
      )
    } else if (section.title === 'History' || section.title === 'Pending') {
      children.push(
        <Transaction
          accountID={this.props.accountID}
          paymentID={item.paymentID}
          key={`${this.props.accountID}:${item.paymentID}`}
        />
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

  _renderSectionHeader = ({section}) => (
    <Kb.BackgroundRepeatBox
      imageHeight={stripePatternSize}
      imageName={stripePatternName}
      imageWidth={stripePatternSize}
      skipBackground={!section.stripeHeader}
      style={styles.sectionHeader}
    >
      <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
    </Kb.BackgroundRepeatBox>
  )

  _onEndReached = () => {
    this.props.onLoadMore()
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" style={{flexGrow: 1}} fullHeight={true}>
        <Header navigateAppend={this.props.navigateAppend} navigateUp={this.props.navigateUp} />
        <Kb.SectionList
          sections={this.props.sections}
          renderItem={this._renderItem}
          renderSectionHeader={this._renderSectionHeader}
          keyExtractor={this._keyExtractor}
          onEndReached={this._onEndReached}
        />
        {this.props.loadingMore && <Kb.ProgressIndicator style={styles.loadingMore} />}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
    backgroundColor: Styles.globalColors.blue5,
    padding: Styles.globalMargins.xtiny,
    width: '100%',
  },
  spinner: {
    height: 46,
    padding: Styles.globalMargins.tiny,
    width: 46,
  },
})

export default Wallet
