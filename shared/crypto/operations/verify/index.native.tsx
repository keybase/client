import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, InputActionsBar, OperationBanner} from '../../input'
import {OperationOutput, SignedSender, OutputActionsBar} from '../../output'

const operation = Constants.Operations.Verify

export const VerifyInput = () => (
  <>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
    <InputActionsBar operation={operation} />
  </>
)
export const VerifyOutput = () => (
  <>
    <SignedSender operation={operation} />
    <Kb.Divider />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </>
)

const navigationOptions = {
  header: undefined,
  title: 'Verify',
}

VerifyInput.navigationOptions = navigationOptions
VerifyOutput.navigationOptions = navigationOptions

export default VerifyInput
