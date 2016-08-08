// @flow

import React, {Component} from 'react'
import {Box, Button, Input, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles/style-guide'
import type {Props} from './add'

type SmallInputProps = {
  hintText: string,
  label: string,
  value: ?string,
  onChange: (next: string) => void,
  errorState: boolean,
}

function SmallInput ({hintText, label, onChange, value, errorState}: SmallInputProps) {
  return (
    <Box style={{...globalStyles.flexBoxRow, position: 'relative'}}>
      <Text type='BodySmall' style={{position: 'absolute', bottom: 6, left: 2, color: (errorState ? globalColors.red : globalColors.blue)}}>{label}</Text>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Input hintText={hintText}
          hintStyle={{textAlign: 'left', marginLeft: 60, marginTop: 6, top: undefined}}
          inputStyle={{textAlign: 'left', marginLeft: 60, top: 2}}
          value={value}
          textStyle={{height: undefined}}
          underlineStyle={errorState ? {backgroundColor: globalColors.red} : {}}
          onChangeText={onChange} />
      </Box>
    </Box>
  )
}

class PgpAdd extends Component<void, Props, void> {
  render () {
    const nextDisabled = !this.props.email1 || !this.props.fullName
    return (
      <Box style={containerStyle}>
        {/* TODO(MM) when we get the pgp icon, put it in here */}
        <Box style={{backgroundColor: 'black', width: 48, height: 48, alignSelf: 'center'}} />
        <Text
          style={{marginTop: globalMargins.medium, alignSelf: 'center'}}
          type='Body'>
          Fill in your public info.
        </Text>
        <Input floatingLabelText='Your full name' value={this.props.fullName}
          onChangeText={this.props.onChangeFullName} textStyle={{height: undefined}} />
        <SmallInput label='Email 1:' hintText='(required)' onChange={this.props.onChangeEmail1} value={this.props.email1} errorState={this.props.errorEmail1} />
        <SmallInput label='Email 2:' hintText='(optional)' onChange={this.props.onChangeEmail2} value={this.props.email2} errorState={this.props.errorEmail2} />
        <SmallInput label='Email 3:' hintText='(optional)' onChange={this.props.onChangeEmail3} value={this.props.email3} errorState={this.props.errorEmail3} />
        <Text
          style={{marginTop: globalMargins.small, marginBottom: globalMargins.medium, alignSelf: 'center',
            ...(this.props.errorText ? {color: globalColors.red} : {})}}
          type='BodySmall'>
          {this.props.errorText || 'Include any addresses you plan to use for PGP encrypted email.'}
        </Text>
        <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
          <Button type='Secondary' label='Cancel' onClick={this.props.onCancel} />
          <Button type='Primary' label='Let the math begin' disabled={nextDisabled} onClick={this.props.onNext} />
        </Box>
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  padding: globalMargins.medium,
}

export default PgpAdd
