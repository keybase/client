// @flow
import React from 'react'
import {Box, Button, Input, Text, ScrollView} from '../../common-adapters/index'
import {SuccessComponent, styleContainer, stylePadding} from './index.shared'
import {PopupDialog} from '../../common-adapters/'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from '.'
const EntryComponent = ({errorText, name, onNameChange, onSubmit}) => (
  <ScrollView>
    <Box style={globalStyles.flexBoxColumn}>
      {!!errorText &&
        <Box
          style={{
            ...styleContainer,
            backgroundColor: globalColors.red,
          }}
        >
          <Text
            style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
            type="BodySemibold"
            backgroundMode="HighRisk"
          >
            {errorText}
          </Text>
        </Box>}
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          ...stylePadding,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text type="Header">Join a team</Text>
        <Input
          autoFocus={true}
          hintText="Token or team name"
          value={name}
          onChangeText={onNameChange}
          onEnterKeyDown={onSubmit}
        />
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.large}}>
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

const PopupWrapped = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    {props.success ? <SuccessComponent {...props} /> : <EntryComponent {...props} />}
  </PopupDialog>
)

export default PopupWrapped
