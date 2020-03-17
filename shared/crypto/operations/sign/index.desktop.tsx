import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../../output'
import {SignOutputBanner} from './common'

const operation = Constants.Operations.Sign

export const SignInput = () => (
  <>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
  </>
)

export const SignOutput = () => (
  <>
    <SignOutputBanner />
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </>
)

const Sign = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to sign">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <SignInput />
        <SignOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Sign
