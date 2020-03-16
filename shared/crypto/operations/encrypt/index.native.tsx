import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import Recipients from '../../recipients'
import {Input, OperationBanner, InputActionsBar} from '../../input'
import {SignedSender, OperationOutput, OutputActionsBar} from '../../output'
import {EncryptOptions, EncryptOutputBanner} from './common'

const operation = Constants.Operations.Encrypt

export const EncryptInput = () => {
  return (
    <>
      <OperationBanner operation={operation} />
      <Recipients />
      <Input operation={operation} />
      <InputActionsBar operation={operation}>
        <EncryptOptions />
      </InputActionsBar>
    </>
  )
}

export const EncryptOutput = () => {
  return (
    <>
      <EncryptOutputBanner />
      <SignedSender operation={operation} />
      <Kb.Divider />
      <OperationOutput operation={operation} />
      <OutputActionsBar operation={operation} />
    </>
  )
}

const navigationOptions = {
  header: undefined,
  title: 'Encrypt',
}
EncryptInput.navigationOptions = navigationOptions
EncryptOutput.navigationOptions = navigationOptions

export default EncryptInput
