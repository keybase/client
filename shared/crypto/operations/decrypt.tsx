import * as React from 'react'
import * as Constants from '../../constants/crypto'
import * as Kb from '../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../input'
import OperationOutput, {OutputBar, SignedSender, OutputProgress} from '../output'

const Decrypt = () => {
  const [fileDroppedCounter, setFileDroppedCounter] = React.useState(0)
  return (
    <DragAndDrop
      operation={Constants.Operations.Encrypt}
      prompt="Drop a file to encrypt"
      onClearInput={() => setFileDroppedCounter(prevCount => prevCount + 1)}
    >
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <OperationBanner operation={Constants.Operations.Decrypt} />
        <Input operation={Constants.Operations.Decrypt} fileDroppedCounter={fileDroppedCounter} />
        <OutputProgress operation={Constants.Operations.Decrypt} />
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <SignedSender operation={Constants.Operations.Decrypt} />
          <OperationOutput operation={Constants.Operations.Decrypt} />
          <OutputBar operation={Constants.Operations.Decrypt} />
        </Kb.Box2>
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Decrypt
