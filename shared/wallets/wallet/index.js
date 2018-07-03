// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, Divider, ScrollView, SectionList, Text} from '../../common-adapters'
import Header from './header-container'
import Asset from '../asset/container'
import Transaction from '../transaction/container'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'

type Props = {
  accountID: Types.AccountID,
  sections: any[],
}

export default (props: Props) => {
  const renderItem = ({item, index, section}) => {
    const children = []
    if (section.title === 'Your assets') {
      children.push(
        <Asset accountID={props.accountID} index={item.item} key={`${props.accountID}:${item.item}`} />
      )
    } else if (section.title === 'History') {
      children.push(
        // $FlowIssue thinks these props aren't in `Transaction`
        <Transaction
          accountID={props.accountID}
          paymentID={item.item.paymentID}
          key={`${props.accountID}:${item.item.paymentID}`}
        />
      )
    }
    if (index !== section.data.length - 1) {
      // don't put divider after last thing in section
      children.push(<Divider key={`${props.accountID}:${item.item}:divider`} />)
    }
    // TODO
    return children
  }

  const renderSectionHeader = ({section}) => (
    <Box2 direction="vertical" fullWidth={true} style={styles.assetHeader}>
      <Text type="BodySmallSemibold">{section.title}</Text>
    </Box2>
  )

  return (
    <Box2 direction="vertical" style={{flexGrow: 1}} fullHeight={true} gap="small">
      <Header />
      <ScrollView>
        <SectionList
          sections={props.sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
        />
      </ScrollView>
    </Box2>
  )
}

const styles = styleSheetCreate({
  assetHeader: {
    backgroundColor: globalColors.blue5,
    padding: globalMargins.xtiny,
  },
})
