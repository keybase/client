// @flow
import avatar from './avatar.stories'
import box from './box.stories'
import button from './button.stories'
import buttonBar from './button-bar.stories'
import checkbox from './checkbox.stories'
import choiceList from './choice-list.stories'
import dropdown from './dropdown.stories'
import formWithCheckbox from './form-with-checkbox.stories'
import icon from './icon.stories'
import input from './input.stories'
import listItem from './list-item.stories'
import meta from './meta.stories'
import nameWithIcon from './name-with-icon.stories'
import popupMenu from './popup-menu.stories'
import radiobutton from './radio-button.stories'
import saveIndicator from './save-indicator.stories'
import standardScreen from './standard-screen.stories'
import text from './text.stories'

const load = () => {
  ;[
    avatar,
    box,
    button,
    buttonBar,
    checkbox,
    choiceList,
    dropdown,
    formWithCheckbox,
    icon,
    input,
    listItem,
    meta,
    nameWithIcon,
    popupMenu,
    radiobutton,
    saveIndicator,
    standardScreen,
    text,
  ].forEach(load => load())
}

export default load
