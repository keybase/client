import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as Kb from '../../../common-adapters'
import {Input, InputActionsBar, OperationBanner} from '../../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../../output'
import {SignOutputBanner} from './common'

const operation = Constants.Operations.Sign

export const SignInput = () => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    return () => {
      dispatch(CryptoGen.createResetOperation({operation}))
    }
  }, [dispatch])
  return (
    <Kb.KeyboardAvoidingView2>
      <OperationBanner operation={operation} />
      <Input operation={operation} />
      <InputActionsBar operation={operation} />
    </Kb.KeyboardAvoidingView2>
  )
}
export const SignOutput = () => (
  <>
    <SignOutputBanner />
    <SignedSender operation={operation} />
    <Kb.Divider />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </>
)

export default SignInput
