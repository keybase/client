import * as React from 'react'
import * as Constants from '../../constants/crypto'
import * as Kb from '../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../input'
import OperationOutput, {OutputBar, SignedSender, OutputProgress} from '../output'

const operation = Constants.Operations.Decrypt

const Decrypt = () => {
  const [fileDroppedCounter, setFileDroppedCounter] = React.useState(0)
  return (
    <DragAndDrop
      operation={operation}
      prompt="Drop a file to encrypt"
      onClearInput={() => setFileDroppedCounter(prevCount => prevCount + 1)}
    >
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <OperationBanner operation={operation} />
        <Input operation={operation} fileDroppedCounter={fileDroppedCounter} />
        <OutputProgress operation={operation} />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <SignedSender operation={operation} />
          <OperationOutput operation={operation} />
          <OutputBar operation={operation} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Decrypt
