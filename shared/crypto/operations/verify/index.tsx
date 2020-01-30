import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import OperationOutput, {SignedSender, OutputBar, OutputProgress} from '../../output'

const Verify = () => {
  const [fileDroppedCounter, setFileDroppedCounter] = React.useState(0)
  return (
    <DragAndDrop
      operation={Constants.Operations.Sign}
      prompt="Drop a file to verify"
      onClearInput={() => setFileDroppedCounter(prevCount => prevCount + 1)}
    >
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <OperationBanner operation={Constants.Operations.Verify} />
        <Input operation={Constants.Operations.Verify} fileDroppedCounter={fileDroppedCounter} />
        <OutputProgress operation={Constants.Operations.Verify} />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <SignedSender operation={Constants.Operations.Verify} />
          <OperationOutput operation={Constants.Operations.Verify} />
          <OutputBar operation={Constants.Operations.Verify} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Verify
