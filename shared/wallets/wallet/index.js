// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import Header from './header/container'
import Asset from '../asset/container'
import Transaction from '../transaction/container'

type Props = {
  accountID: Types.AccountID,
  navigateAppend: (...Array<any>) => any,
  navigateUp: () => any,
  sections: any[],
}

const HistoryPlaceholder = () => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.historyPlaceholder}>
    <Kb.Text type="BodySmall" style={styles.historyPlaceholderText}>
      You don’t have any history with this account.
    </Kb.Text>
  </Kb.Box2>
)

class Wallet extends React.Component<Props> {
  _renderItem = ({item, index, section}) => {
    const children = []
    if (item === 'notLoadedYet') {
      children.push(<Kb.ProgressIndicator key="spinner" style={styles.spinner} type="Small" />)
    } else if (section.title === 'Your assets') {
      children.push(
        <Asset accountID={this.props.accountID} index={item} key={`${this.props.accountID}:${item}`} />
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
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.assetHeader}>
      <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
    </Kb.Box2>
  )
  render() {
    return (
      <Kb.Box2 direction="vertical" style={{flexGrow: 1}} fullHeight={true}>
        <Header navigateAppend={this.props.navigateAppend} navigateUp={this.props.navigateUp} />
        <Kb.SectionList
          sections={this.props.sections}
          renderItem={this._renderItem}
          renderSectionHeader={this._renderSectionHeader}
          keyExtractor={this._keyExtractor}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  assetHeader: {
    backgroundColor: Styles.globalColors.blue5,
    padding: Styles.globalMargins.xtiny,
  },
  historyPlaceholder: {
    marginTop: 36,
  },
  historyPlaceholderText: {
    color: Styles.globalColors.black_40,
  },
  spinner: {
    height: 46,
    padding: Styles.globalMargins.tiny,
    width: 46,
  },
})

export default Wallet
