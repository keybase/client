// @flow
import * as React from 'react'
import {Box, Dropdown, Text} from '../../../../common-adapters'
import {globalStyles} from '../../../../styles'
import {Hoc} from './index.shared'
import type {ViewProps} from './'

const itemToNode = item => (
  <Box style={{...globalStyles.flexBoxCenter, width: '100%'}} key={item.value}>
    <Text type="BodyBig" style={{textAlign: 'center'}}>
      {item.label}
    </Text>
  </Box>
)

const View = (props: ViewProps) => {
  const items = props.items.map(itemToNode)
  const selectedItem = itemToNode(props.selectedItem)
  if (props.teamItem) {
    items.unshift(itemToNode(props.teamItem))
  }
  return (
    // $FlowIssue doesn't know about the `key` prop of React.Node
    <Dropdown items={items} selected={selectedItem} onChanged={item => props.onSelect(item && item.key)} />
  )
}

export default Hoc(View)
