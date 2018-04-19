// @flow
import avatar from './avatar.stories'
import box from './box.stories'
import button from './button.stories'
import buttonBar from './button-bar.stories'
import checkbox from './checkbox.stories'
import dropdown from './dropdown.stories'
import formWithCheckbox from './form-with-checkbox.stories'
import icon from './icon.stories'
import input from './input.stories'
import nameWithIcon from './name-with-icon.stories'
import radiobutton from './radio-button.stories'
import saveIndicator from './save-indicator.stories'
import text from './text.stories'

const load = () => {
  avatar()
  box()
  button()
  buttonBar()
  checkbox()
  dropdown()
  formWithCheckbox()
  icon()
  input()
  nameWithIcon()
  radiobutton()
  saveIndicator()
  text()
}

export default load
