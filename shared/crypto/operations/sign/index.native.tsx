import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, InputActionsBar, OperationBanner} from '../../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../../output'
import {SignOutputBanner} from './common'

const operation = Constants.Operations.Sign

export const SignInput = () => (
  <>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
    <InputActionsBar operation={operation} />
  </>
)
export const SignOutput = () => (
  <>
    <SignOutputBanner />
    <SignedSender operation={operation} />
    <Kb.Divider />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </>
)

const navigationOptions = {
  header: undefined,
  title: 'Sign',
}
SignInput.navigationOptions = navigationOptions
SignOutput.navigationOptions = navigationOptions

export default SignInput
