// @flow
import React from 'react'
import {SuccessComponent} from './index.shared'
import {Box, HeaderHoc, ScrollView, Input, Button} from '../../common-adapters/'
import {compose, withProps, branch, renderComponent} from 'recompose'
import {globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const EntryComponent = ({errorText, name, onNameChange, onSubmit}: Props) => (
  <ScrollView>
    <Box style={globalStyles.flexBoxColumn}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: globalMargins.small,
        }}
      >
        <Input
          autoFocus={true}
          hintText="Token or team name"
          value={name}
          onChangeText={onNameChange}
          onEnterKeyDown={onSubmit}
          errorText={errorText}
        />
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
          <Button
            type="Primary"
            style={{marginLeft: globalMargins.tiny}}
            onClick={onSubmit}
            label="Continue"
          />
        </Box>
      </Box>
    </Box>
  </ScrollView>
)

export default compose(
  withProps((props: Props) => ({
    headerStyle: {borderBottomWidth: 0},
    title: 'Join a team',
  })),
  HeaderHoc,
  branch((props: Props) => props.success, renderComponent(SuccessComponent))
)(EntryComponent)
