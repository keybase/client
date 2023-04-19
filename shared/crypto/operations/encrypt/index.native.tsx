import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as Kb from '../../../common-adapters'
import Recipients from '../../recipients'
import {Input, OperationBanner, InputActionsBar} from '../../input'
import {SignedSender, OperationOutput, OutputActionsBar} from '../../output'
import {EncryptOptions, EncryptOutputBanner} from './common'

const operation = Constants.Operations.Encrypt

export const EncryptInput = () => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    return () => {
      dispatch(CryptoGen.createResetOperation({operation}))
    }
  }, [dispatch])

  return (
    <Kb.KeyboardAvoidingView2>
      <OperationBanner operation={operation} />
      <Recipients />
      <Input operation={operation} />
      <InputActionsBar operation={operation}>
        <EncryptOptions />
      </InputActionsBar>
    </Kb.KeyboardAvoidingView2>
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

export default EncryptInput
