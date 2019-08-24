import {Keyboard} from 'react-native'
import {isIOS} from '../constants/platform'

let open = false
Keyboard.addListener(isIOS ? 'keyboardWillShow' : 'keyboardDidShow', () => (open = true))
Keyboard.addListener(isIOS ? 'keyboardWillHide' : 'keyboardDidHide', () => (open = false))

const isOpen = () => open
const dismiss = Keyboard.dismiss
export {dismiss, isOpen}
