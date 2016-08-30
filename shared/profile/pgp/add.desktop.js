// @flow
import React, {Component} from 'react'
import {Box, Button, Input, PlatformIcon, SmallInput, StandardScreen, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import type {Props} from './add'

class PgpAdd extends Component<void, Props, void> {
  render () {
    const nextDisabled = !this.props.email1 || !this.props.fullName || !!this.props.errorText
    return (
      <StandardScreen
        style={styleContainer}
        onClose={this.props.onCancel}>
        {/* TODO(MM) when we get the pgp icon, put it in here */}
        <PlatformIcon
          platform='pgp'
          overlay='icon-proof-unfinished'
          style={styleIcon} />
        <Text
          style={styleHeader}
          type='Body'>
          Fill in your public info.
        </Text>
        <Input
          floatingLabelText='Your full name'
          value={this.props.fullName}
          onChangeText={this.props.onChangeFullName}
          textStyle={{height: undefined}} />
        <SmallInput
          label='Email 1:'
          hintText='(required)'
          onChange={this.props.onChangeEmail1}
          value={this.props.email1}
          errorState={this.props.errorEmail1} />
        <SmallInput
          label='Email 2:'
          hintText='(optional)'
          onChange={this.props.onChangeEmail2}
          value={this.props.email2}
          errorState={this.props.errorEmail2} />
        <SmallInput
          label='Email 3:'
          hintText='(optional)'
          onChange={this.props.onChangeEmail3}
          value={this.props.email3}
          errorState={this.props.errorEmail3} />
        <Text
          style={styleInfoMessage(!!this.props.errorText)}
          type='BodySmall'>
          {this.props.errorText || 'Include any addresses you plan to use for PGP encrypted email.'}
        </Text>
        <Box style={styleActions}>
          <Button
            type='Secondary'
            label='Cancel'
            onClick={this.props.onCancel} />
          <Button
            type='Primary'
            label='Let the math begin'
            disabled={nextDisabled}
            onClick={this.props.onNext} />
        </Box>
      </StandardScreen>
    )
  }
}

const styleContainer = {
  alignItems: undefined,
  maxWidth: 460,
  width: '100%',
}

const styleIcon = {
  alignSelf: 'center',
}

const styleHeader = {
  marginTop: globalMargins.medium,
  alignSelf: 'center',
}

const styleInfoMessage = (errorText: boolean) => ({
  marginTop: globalMargins.small,
  alignSelf: 'center',
  ...(errorText ? {color: globalColors.red} : {}),
})

const styleActions = {
  ...globalStyles.flexBoxRow,
  alignSelf: 'center',
  marginTop: globalMargins.medium,
}

export default PgpAdd
