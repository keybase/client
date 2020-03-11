import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, SignedSender} from '../../output'

const operation = Constants.Operations.Decrypt

export const DecryptInput = () => (
  <>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
  </>
)

export const DecryptOutput = () => (
  <>
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputBar operation={operation} />
  </>
)

const Decrypt = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to encrypt">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <DecryptInput />
        <DecryptOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Decrypt
