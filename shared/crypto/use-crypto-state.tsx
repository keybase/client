// import * as Container from '../util/container'

// type Common = {
// bytesComplete: number
// bytesTotal: number
// errorMessage: Container.HiddenString
// inProgress: boolean
// input: Container.HiddenString
// inputType: InputTypes
// output: Container.HiddenString
// outputFileDestination: Container.HiddenString
// outputSenderFullname?: Container.HiddenString
// outputSenderUsername?: Container.HiddenString
// outputSigned?: boolean
// outputStatus?: OutputStatus
// outputType?: OutputType
// warningMessage: Container.HiddenString
// // to ensure what the user types matches the input
// outputValid: boolean
// }

// type State = {
//   readonly decrypt: Common
//   readonly encrypt: Common & {
// meta: {
//   hasRecipients: boolean
//   hasSBS: boolean
//   hideIncludeSelf: boolean
// }
// options: EncryptOptions
// recipients: Array<string> // Only for encrypt operation
//   }
//   readonly sign: Common
//   readonly verify: Common
// }
// export const useCryptoState = Container.createZustand(
//   Container.immerZustand<State>(set => ({
//     _: () => {
//       set(state => {})
//     },
//   }))
// )
export {}
