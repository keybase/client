// @flow
import * as React from 'react'
import {messageExplodeDescriptions} from '../../../../constants/chat2'
import {type MessageExplodeDescription} from '../../../../constants/types/chat2'
import {Box, Icon, Text, FloatingBox} from '../../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, globalStyles} from '../../../../styles'
import type {Props} from '.'

const sortedDescriptions = messageExplodeDescriptions.sort((a, b) => (a.seconds < b.seconds ? 1 : 0))

export default (props: Props) => {
  const selected = props.selected || {text: 'Never', seconds: 0}
  const items = sortedDescriptions.map(it => ({
    onClick: () => props.onSelect(it),
    title: it.text,
    // view: <Item desc={it} selected={selected.seconds === it.seconds} onSelect={props.onSelect} />,
  }))
  return (
    <FloatingBox>
      <Text type="HeaderBig">Hi</Text>
    </FloatingBox>
  )
}
