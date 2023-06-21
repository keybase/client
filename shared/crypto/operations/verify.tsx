// import * as Constants from '../../constants/crypto'
// import * as Container from '../../util/container'
// import * as CryptoGen from '../../actions/crypto-gen'
// import * as Kb from '../../common-adapters'
// import * as React from 'react'
// import {Input, InputActionsBar, DragAndDrop, OperationBanner} from '../input'
// import {OperationOutput, SignedSender, OutputActionsBar} from '../output'

// const operation = Constants.Operations.Verify

export const VerifyInput = () => {
  return null
  // const dispatch = Container.useDispatch()
  // React.useEffect(() => {
  //   return () => {
  //     if (Container.isMobile) {
  //       dispatch(CryptoGen.createResetOperation({operation}))
  //     }
  //   }
  // }, [dispatch])

  // const content = (
  //   <>
  //     <OperationBanner operation={operation} />
  //     <Input operation={operation} />
  //     {Container.isMobile ? <InputActionsBar operation={operation} /> : null}
  //   </>
  // )

  // return Container.isMobile ? (
  //   <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  // ) : (
  //   <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.inputDesktopMaxHeight}>
  //     {content}
  //   </Kb.Box2>
  // )
}
export const VerifyOutput = () => {
  return null
  // const content = (
  //   <>
  //     <SignedSender operation={operation} />
  //     {Container.isMobile ? <Kb.Divider /> : null}
  //     <OperationOutput operation={operation} />
  //     <OutputActionsBar operation={operation} />
  //   </>
  // )
  // return Container.isMobile ? (
  //   content
  // ) : (
  //   <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.outputDesktopMaxHeight}>
  //     {content}
  //   </Kb.Box2>
  // )
}

export const VerifyIO = () => {
  return null
  // return (
  //   <DragAndDrop operation={operation} prompt="Drop a file to verify">
  //     <Kb.Box2 direction="vertical" fullHeight={true}>
  //       <VerifyInput />
  //       <Kb.Divider />
  //       <VerifyOutput />
  //     </Kb.Box2>
  //   </DragAndDrop>
  // )
}
