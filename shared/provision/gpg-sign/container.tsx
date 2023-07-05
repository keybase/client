// import * as ProvisionGen from '../../actions/provision-gen'
// import * as Container from '../../util/container'
// import * as Constants from '../../constants/provision'
// import GPGSign from '.'

// export default () => {
//   const importError = Constants.useState(s => s.gpgImportError)
//   const dispatch = Container.useDispatch()
//   const onAcceptGpgSign = () => {
//     dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: true}))
//   }
//   const onBack = () => {}
//   const onRejectGpgSign = () => {
//     dispatch(ProvisionGen.createSubmitGPGSignOK({accepted: false}))
//   }
//   const onSubmitGpgMethod = (exportKey: boolean) => {
//     dispatch(ProvisionGen.createSubmitGPGMethod({exportKey}))
//   }
//   const props = {
//     importError: importError,
//     onBack: importError ? onRejectGpgSign : onBack,
//     onSubmit: importError ? onAcceptGpgSign : onSubmitGpgMethod,
//   }
//   return <GPGSign {...props} />
// }
export {}
