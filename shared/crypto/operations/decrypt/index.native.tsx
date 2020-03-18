import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/crypto'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as Kb from '../../../common-adapters'
import {Input, InputActionsBar, OperationBanner} from '../../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../../output'

const operation = Constants.Operations.Decrypt

export const DecryptInput = () => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    return () => {
      dispatch(CryptoGen.createResetOperation({operation}))
    }
  }, [dispatch])
  return (
    <>
      <OperationBanner operation={operation} />
      <Input operation={operation} />
      <InputActionsBar operation={operation} />
    </>
  )
}

export const DecryptOutput = () => (
  <>
    <SignedSender operation={operation} />
    <Kb.Divider />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </>
)

const navigationOptions = {
  header: undefined,
  title: 'Decrypt',
}

DecryptInput.navigationOptions = navigationOptions
DecryptOutput.navigationOptions = navigationOptions

export default DecryptInput
