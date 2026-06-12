import * as Crypto from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import {DragAndDrop} from './input'

// Desktop-only side-by-side input/output layout shared by the encrypt/decrypt/sign/verify screens.
type Props = {
  allowFolders: boolean
  divider?: boolean
  inProgress: boolean
  input: React.ReactNode
  onAttach: (path: string) => void
  output: React.ReactNode
  prompt: string
  testID?: string
}

const OperationIO = ({allowFolders, divider, inProgress, input, onAttach, output, prompt, testID}: Props) => (
  <DragAndDrop
    allowFolders={allowFolders}
    prompt={prompt}
    inProgress={inProgress}
    onAttach={onAttach}
    testID={testID}
  >
    <Kb.Box2 direction="vertical" fullHeight={true}>
      <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
        {input}
      </Kb.Box2>
      {divider ? <Kb.Divider /> : null}
      <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
        {output}
      </Kb.Box2>
    </Kb.Box2>
  </DragAndDrop>
)

export default OperationIO
