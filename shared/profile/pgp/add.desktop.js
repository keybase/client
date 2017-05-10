// @flow
import React, {Component} from 'react'
import {
  Box,
  Button,
  Input,
  PlatformIcon,
  StandardScreen,
  Text,
} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import type {Props} from './add'

class PgpAdd extends Component<void, Props, void> {
  render() {
    const nextDisabled =
      !this.props.email1 || !this.props.fullName || !!this.props.errorText
    return (
      <StandardScreen style={styleContainer} onClose={this.props.onCancel}>
        {/* TODO(MM) when we get the pgp icon, put it in here */}
        <PlatformIcon
          platform="pgp"
          overlay="icon-proof-unfinished"
          style={styleIcon}
        />
        <Text style={styleHeader} type="BodySemibold">
          {' '}Fill in your public info.
        </Text>
        <Input
          hintText="Your full name"
          value={this.props.fullName}
          onChangeText={this.props.onChangeFullName}
        />
        <Input
          small={true}
          smallLabel="Email 1:"
          hintText="(required)"
          onChangeText={this.props.onChangeEmail1}
          value={this.props.email1}
          errorText={this.props.errorEmail1 ? 'error' : null}
        />
        <Input
          small={true}
          smallLabel="Email 2:"
          hintText="(optional)"
          onChangeText={this.props.onChangeEmail2}
          value={this.props.email2}
          errorText={this.props.errorEmail2 ? 'error' : null}
        />
        <Input
          small={true}
          smallLabel="Email 3:"
          hintText="(optional)"
          onChangeText={this.props.onChangeEmail3}
          value={this.props.email3}
          errorText={this.props.errorEmail3 ? 'error' : null}
        />
        <Text
          style={styleInfoMessage(!!this.props.errorText)}
          type={this.props.errorText ? 'BodyError' : 'Body'}
        >
          {this.props.errorText ||
            'Include any addresses you plan to use for PGP encrypted email.'}
        </Text>
        <Box style={styleActions}>
          <Button
            type="Secondary"
            label="Cancel"
            onClick={this.props.onCancel}
          />
          <Button
            type="Primary"
            label="Let the math begin"
            disabled={nextDisabled}
            onClick={this.props.onNext}
          />
          {' '}
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
})

const styleActions = {
  ...globalStyles.flexBoxRow,
  alignSelf: 'center',
  marginTop: globalMargins.medium,
}

export default PgpAdd
