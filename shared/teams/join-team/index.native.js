// @flow
import React from 'react'
import {SuccessComponent} from './index.shared'
import {Box, HeaderHoc, ScrollView, Input, Button} from '../../common-adapters/'
import {compose, withProps} from 'recompose'
import {globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const EntryComponent = ({errorText, name, onNameChange, onSubmit}) => (
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
        <Button type="Primary" style={{marginLeft: globalMargins.tiny}} onClick={onSubmit} label="Continue" />
      </Box>
    </Box>
  </Box>
)

export const Contents = (props: Props) => (
  <ScrollView>
    {!!props.success && SuccessComponent(props)}
    {!props.success && EntryComponent(props)}
  </ScrollView>
)

export default compose(
  withProps(props => ({
    // customComponent: <Header {...props} />,
    showBorder: false,
    title: 'Join a team',
  })),
  HeaderHoc
)(Contents)
