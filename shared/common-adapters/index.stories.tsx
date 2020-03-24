import animated from './animated.stories'
import avatar from './avatar.stories'
import avatarLine from './avatar-line.stories'
import backButton from './back-button.stories'
import badge from './badge.stories'
import banner from './banner.stories'
import box from './box.stories'
import button from './button.stories'
import buttonBar from './button-bar.stories'
import checkbox from './checkbox.stories'
import checkCircle from './check-circle.stories'
import choiceList from './choice-list.stories'
import confirmModal from './confirm-modal/index.stories'
import copyText from './copy-text.stories'
import copyableText from './copyable-text.stories'
import dropdown from './dropdown.stories'
import floatingMenu from './floating-menu/index.stories'
import header from './header-hoc/index.stories'
import icon from './icon.stories'
import input from './input.stories'
import labeledInput from './labeled-input.stories'
import list from './list.stories'
import listItem from './list-item.stories'
import listItem2 from './list-item2.stories'
import markdown from './markdown/index.stories'
import meta from './meta.stories'
import mobilePopup from './mobile-popup.stories'
import modal from './modal/index.stories'
import nameWithIcon from './name-with-icon/index.stories'
import newInput from './new-input.stories'
import placeholder from './placeholder.stories'
import plainInput from './plain-input.stories'
import popupDialog from './popup-dialog.stories'
import proofBrokenBanner from './proof-broken-banner.stories'
import radiobutton from './radio-button.stories'
import reload from './reload.stories'
import richbutton from './rich-button.stories'
import saveIndicator from './save-indicator.stories'
import searchFilter from './search-filter.stories'
import sectionList from './section-list.stories'
import switchStories from './switch.stories'
import text from './text.stories'
import tooltip from './tooltip.stories'
import video from './video.stories'
import profileCard from './profile-card.stories'
import waveButton from './wave-button.stories'

const load = () => {
  ;[
    avatarLine,
    animated,
    avatar,
    backButton,
    badge,
    banner,
    box,
    button,
    buttonBar,
    checkCircle,
    checkbox,
    choiceList,
    confirmModal,
    copyText,
    copyableText,
    dropdown,
    floatingMenu,
    header,
    icon,
    input,
    labeledInput,
    list,
    listItem,
    listItem2,
    markdown,
    meta,
    mobilePopup,
    modal,
    nameWithIcon,
    newInput,
    placeholder,
    plainInput,
    popupDialog,
    profileCard,
    proofBrokenBanner,
    radiobutton,
    reload,
    richbutton,
    saveIndicator,
    searchFilter,
    sectionList,
    switchStories,
    text,
    tooltip,
    video,
    waveButton,
  ].forEach(load => load())
}

export default load
