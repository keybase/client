import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, SignedSender, OutputProgress} from '../../output'

type Props = {
  input: string
  inputType: Types.InputTypes
  onClearInput: () => void
  onCopyOutput: (text: string) => void
  onSetInput: (inputType: Types.InputTypes, inputValue: string) => void
  onShowInFinder: (path: string) => void
  output: string
  outputSender?: string
  outputSigned: boolean
  outputMatchesInput: boolean
  outputStatus?: Types.OutputStatus
  outputType?: Types.OutputType
  progress: number
  username?: string
  errorMessage: string
  warningMessage: string
}

const Decrypt = (props: Props) => {
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
