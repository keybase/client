// @flow
import avatar from './avatar.stories'
import backButton from './back-button.stories'
import badge from './badge.stories'
import banner from './banner.stories'
import box from './box.stories'
import button from './button.stories'
import buttonBar from './button-bar.stories'
import checkbox from './checkbox.stories'
import choiceList from './choice-list.stories'
import copyText from './copy-text.stories'
import dropdown from './dropdown.stories'
import formWithCheckbox from './form-with-checkbox.stories'
import floatingMenu from './floating-menu/index.stories'
import header from './header-hoc/index.stories'
import icon from './icon.stories'
import input from './input.stories'
import list from './list.stories'
import listItem from './list-item.stories'
import listItem2 from './list-item2.stories'
import markdown from './markdown/index.stories'
import meta from './meta.stories'
import nameWithIcon from './name-with-icon/index.stories'
import newInput from './new-input.stories'
import placeholder from './placeholder.stories'
import plainInput from './plain-input.stories'
import popupDialog from './popup-dialog.stories'
import radiobutton from './radio-button.stories'
import reload from './reload.stories'
import saveIndicator from './save-indicator.stories'
import sectionList from './section-list.stories'
import standardScreen from './standard-screen.stories'
import text from './text.stories'
import tooltip from './tooltip.stories'

const load = () => {
  ;[
    avatar,
    backButton,
    badge,
    banner,
    box,
    button,
    buttonBar,
    checkbox,
    choiceList,
    copyText,
    dropdown,
    formWithCheckbox,
    floatingMenu,
    header,
    icon,
    input,
    list,
    listItem,
    listItem2,
    markdown,
    meta,
    nameWithIcon,
    newInput,
    placeholder,
    plainInput,
    popupDialog,
    radiobutton,
    reload,
    saveIndicator,
    sectionList,
    standardScreen,
    text,
    tooltip,
  ].forEach(load => load())
}

export default load
