import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import OperationOutput, {SignedSender, OutputBar, OutputProgress} from '../../output'

type Props = {
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onShowInFinder: (path: string) => void
  outputMatchesInput: boolean
  output: string
  outputSender?: string
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
  errorMessage: string
  warningMessage: string
}

const Verify = (props: Props) => {
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
