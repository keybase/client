import * as React from 'react'
import * as Constants from '../../constants/crypto'
import * as Kb from '../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../input'
import OperationOutput, {SignedSender, OutputBar} from '../output'

const operation = Constants.Operations.Verify

const Verify = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to verify">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <OperationBanner operation={operation} />
        <Input operation={operation} />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <SignedSender operation={operation} />
          <OperationOutput operation={operation} />
          <OutputBar operation={operation} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Verify
