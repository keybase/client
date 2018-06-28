// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, SectionList, Text} from '../../common-adapters'
import Header from './header-container'
import Asset from '../asset/container'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'

type Props = {
  accountID: Types.AccountID,
  sections: any[],
}

export default (props: Props) => {
  const renderItem = ({item, index, section}) => {
    if (section.title === 'Your assets') {
      return <Asset accountID={props.accountID} index={item.item} />
    }
    // TODO
    return null
  }

  const renderSectionHeader = ({section}) => (
    <Box2 direction="vertical" fullWidth={true} style={styles.assetHeader}>
      <Text type="BodySmallSemibold">{section.title}</Text>
    </Box2>
  )

  return (
    <Box2
      direction="vertical"
      style={{flexGrow: 1}}
      fullHeight={true}
      gap="small"
      gapStart={true}
      gapEnd={true}
    >
      <Header />
      <SectionList
        sections={props.sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
      />
    </Box2>
  )
}

const styles = styleSheetCreate({
  assetHeader: {
    backgroundColor: globalColors.blue5,
    padding: globalMargins.xtiny,
  },
})
