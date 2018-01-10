// @flow
import * as React from 'react'
import {ScrollView, CheckBox, Text, Box} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

export type Props = {
  channelNames: Array<string>,
  selected: string,
  onSelect: (channel: string) => void,
  onSubmit: () => void,
  onCancel: () => void,
}

export default (props: Props) => (
  <ScrollView contentContainerStyle={{padding: globalMargins.medium}}>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        paddingTop: globalMargins.xtiny,
        paddingBottom: globalMargins.xtiny,
      }}
    >
      <Text type="Header">Hi!</Text>
    </Box>
  </ScrollView>
)
