// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../styles'
import {Box, Button, Text, ButtonBar} from '../common-adapters'

type Props = {
  counter: number,
  you: ?string,
  increase: () => void,
  increase10: () => void,
}

const Fs = ({counter, you, increase, increase10}: Props) => (
  <Box style={containerStyle}>
    <Text type="Header">Hi {you}!</Text>
    <Text type="BodySemibold">Count: {counter}</Text>
    <ButtonBar align="flex-start">
      <Button type="Primary" onClick={increase} label="Up by 1" />
      <Button type="Primary" onClick={increase10} label="Up by 10" />
    </ButtonBar>
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  padding: globalMargins.xlarge,
}

export default Fs
