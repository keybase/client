/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type animationType from './animation'
import type avatarlineType from './avatar-line'
import type avatarType from './avatar'
import type backbuttonType from './back-button'
import type backgroundrepeatboxType from './background-repeat-box'
import type badgeType from './badge'
import type {Banner as bannerType, BannerParagraph as bannerParagraphType} from './banner'
import type boxgrowType from './box-grow'
import type boxType from './box'
import type buttonbarType from './button-bar'
import type buttonType from './button'
import type checkcircleType from './check-circle'
import type checkboxType from './checkbox'
import type choicelistType from './choice-list'
import type clickableboxType from './clickable-box'
import type confirmmodalindexType from './confirm-modal/index'
import type copytextType from './copy-text'
import type copyabletextType from './copyable-text'
import type customemojiType from './custom-emoji'
import type delayedmountingType from './delayed-mounting'
import type desktopstyleType from './desktop-style'
import type dividerType from './divider'
import type draganddropType from './drag-and-drop'
import type dropdownType from './dropdown'
import type emojiType from './emoji'
import type errorboundaryType from './error-boundary'
import type floatingboxType from './floating-box'
import type floatingmenuType from './floating-menu'
import type floatingpickerType from './floating-picker'
import type {
  HeaderHocHeader as headerHocHeaderType,
  HeaderHocWrapper as headerHocWrapperType,
  HeaderLeftBlank as headerLeftBlankType,
  HeaderLeftCancel as headerLeftCancelType,
} from './header-hoc'
import type {PopupWrapper as headerorpopupType} from './header-or-popup'
import type {HotKey as hotkeyType} from './hot-key'
import type hoverhocType from './hover-hoc'
import type {isValidIconType as isValidIconTypeType} from './icon.shared'
import type iconType from './icon'
import type imageType from './image'
import type infonoteType from './info-note'
import type inputType from './input'
import type keyboardavoidingviewType from './keyboard-avoiding-view'
import type labeledinputType from './labeled-input'
import type {
  largeHeight as largeHeightType,
  smallHeight as smallHeightType,
  default as listitem2Type,
} from './list-item2'
import type listitemType from './list-item'
import type list2Type from './list2'
import type listType from './list'
import type loadinglineType from './loading-line'
import type {EmojiIfExists as emojiIfExistsType} from './markdown/react'
import type markdownType from './markdown'
import type {MaybePopup as maybepopupType} from './maybe-popup'
import type metaType from './meta'
import type mobilepopupType from './mobile-popup'
import type modalindexType from './modal/index'
import type modal2Type from './modal2'
import type {Header as modalHeaderType} from './modal'
import type multiavatarType from './multi-avatar'
import type namewithiconcontainerType from './name-with-icon/container'
import type namewithiconType from './name-with-icon'
import type newinputType from './new-input'
import type orientedimageType from './oriented-image'
import type overlayparenthocType from './overlay/parent-hoc'
import type overlayType from './overlay'
import type phoneinputType from './phone-input'
import type placeholderType from './placeholder'
import type plaininputType from './plain-input'
import type platformiconType from './platform-icon'
import type popupdialoghocType from './popup-dialog-hoc'
import type popupdialogType from './popup-dialog'
import type popupheadertextType from './popup-header-text'
import type profilecardType from './profile-card'
import type progressbarType from './progress-bar'
import type progressindicatorType from './progress-indicator'
import type proofbrokenbannerType from './proof-broken-banner'
import type radiobuttonType from './radio-button'
import type reloadType from './reload'
import type richbuttonType from './rich-button'
import type roundedboxType from './rounded-box'
import type safeareaviewType from './safe-area-view'
import type saveindicatorType from './save-indicator'
import type scrollviewType from './scroll-view'
import type searchfilterType from './search-filter'
import type sectiondividerType from './section-divider'
import type sectionlistType from './section-list'
import type simpletoastType from './simple-toast'
import type switchType from './switch'
import type tabsType from './tabs'
import type teamwithpopupcontainerType from './team-with-popup/container'
import type textType from './text'
import type timelinemarkerType from './timeline-marker'
import type toastType from './toast'
import type usemountedType from './use-mounted'
import type {usePopup as usepopupType} from './use-popup'
import type {useTimers as usetimersType} from './use-timers'
import type usernamesType from './usernames'
import type videoType from './video'
import type waitingbuttonType from './waiting-button'
import type wavebuttonType from './wave-button'
import type webviewType from './web-view'
import type withtooltipType from './with-tooltip'

module.exports = {
  get Animation() {
    return require('./animation').default as animationType
  },
  get Avatar() {
    return require('./avatar').default as typeof avatarType
  },
  get AvatarLine() {
    return require('./avatar-line').default as typeof avatarlineType
  },
  get BackButton() {
    return require('./back-button').default as backbuttonType
  },
  get BackgroundRepeatBox() {
    return require('./background-repeat-box').default as backgroundrepeatboxType
  },
  get Badge() {
    return require('./badge').default as badgeType
  },
  get Banner() {
    return require('./banner').Banner as typeof bannerType
  },
  get BannerParagraph() {
    return require('./banner').BannerParagraph as typeof bannerParagraphType
  },
  get Box() {
    return require('./box').default as boxType
  },
  get Box2() {
    return require('./box').Box2
  },
  get BoxGrow() {
    return require('./box-grow').default as boxgrowType
  },
  get Button() {
    return require('./button').default as typeof buttonType
  },
  get ButtonBar() {
    return require('./button-bar').default as buttonbarType
  },
  get CheckCircle() {
    return require('./check-circle').default as typeof checkcircleType
  },
  get Checkbox() {
    return require('./checkbox').default as checkboxType
  },
  get ChoiceList() {
    return require('./choice-list').default as choicelistType
  },
  get ClickableBox() {
    return require('./clickable-box').default as clickableboxType
  },
  get ConfirmModal() {
    return require('./confirm-modal/index').default as typeof confirmmodalindexType
  },
  get ConnectedNameWithIcon() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    require('./profile-card').default as typeof profilecardType

    return require('./name-with-icon/container').default as typeof namewithiconcontainerType
  },
  get ConnectedUsernames() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    require('./profile-card').default as typeof profilecardType

    return require('./usernames').default as typeof usernamesType
  },
  get CopyText() {
    return require('./copy-text').default as typeof copytextType
  },
  get CopyableText() {
    return require('./copyable-text').default as copyabletextType
  },
  get CustomEmoji() {
    return require('./custom-emoji').default as customemojiType
  },
  get DelayedMounting() {
    return require('./delayed-mounting').default as typeof delayedmountingType
  },
  get DesktopStyle() {
    return require('./desktop-style').default as typeof desktopstyleType
  },
  get Divider() {
    return require('./divider').default as typeof dividerType
  },
  get DragAndDrop() {
    return require('./drag-and-drop').default as draganddropType
  },
  get Dropdown() {
    return require('./dropdown').default as dropdownType<any>
  },
  get DropdownButton() {
    return require('./dropdown').DropdownButton
  },
  get Emoji() {
    return require('./emoji').default as emojiType
  },
  get EmojiIfExists() {
    return require('./markdown/react').EmojiIfExists as typeof emojiIfExistsType
  },
  get ErrorBoundary() {
    return require('./error-boundary').default as errorboundaryType
  },
  get FloatingBox() {
    return require('./floating-box').default as floatingboxType
  },
  get FloatingMenu() {
    return require('./floating-menu').default as typeof floatingmenuType
  },
  get FloatingPicker() {
    return require('./floating-picker').default as floatingpickerType<any>
  },
  get HeaderHocHeader() {
    return require('./header-hoc').HeaderHocHeader as headerHocHeaderType
  },
  get HeaderHocWrapper() {
    return require('./header-hoc').HeaderHocWrapper as headerHocWrapperType
  },
  get HeaderLeftBlank() {
    return require('./header-hoc').HeaderLeftBlank as headerLeftBlankType
  },
  get HeaderLeftCancel() {
    return require('./header-hoc').HeaderLeftCancel as headerLeftCancelType
  },
  get HotKey() {
    return require('./hot-key').HotKey as typeof hotkeyType
  },
  get HoverHoc() {
    return require('./hover-hoc').default as typeof hoverhocType
  },
  get Icon() {
    return require('./icon').default as iconType
  },
  get Image() {
    return require('./image').default as imageType
  },
  get InfoNote() {
    return require('./info-note').default as typeof infonoteType
  },
  get InlineDropdown() {
    return require('./dropdown').InlineDropdown
  },
  get Input() {
    return require('./input').default as inputType
  },
  get KeyboardAvoidingView() {
    return require('./keyboard-avoiding-view').default as keyboardavoidingviewType
  },
  get LabeledInput() {
    return require('./labeled-input').default as typeof labeledinputType
  },
  get List() {
    return require('./list').default as listType<any>
  },
  get List2() {
    return require('./list2').default as list2Type<any>
  },
  get ListItem() {
    return require('./list-item').default as listitemType
  },
  get ListItem2() {
    return require('./list-item2').default as typeof listitem2Type
  },
  get LoadingLine() {
    return require('./loading-line').default as loadinglineType
  },
  get Markdown() {
    return require('./markdown').default as markdownType
  },
  get MaybePopup() {
    return require('./maybe-popup').MaybePopup as typeof maybepopupType
  },
  get Meta() {
    return require('./meta').default as typeof metaType
  },
  get MobilePopup() {
    return require('./mobile-popup').default as typeof mobilepopupType
  },
  get Modal() {
    return require('./modal').default as typeof modalType
  },
  get Modal2() {
    return require('./modal2').default as typeof modal2Type
  },
  get ModalHeader() {
    return require('./modal').Header as modalHeaderType
  },
  get MultiAvatar() {
    return require('./multi-avatar').default as multiavatarType
  },
  get NameWithIcon() {
    return require('./name-with-icon').default as typeof namewithiconType
  },
  get NewInput() {
    return require('./new-input').default as typeof newinputType
  },
  get OrientedImage() {
    return require('./oriented-image').default as orientedimageType
  },
  get Overlay() {
    return require('./overlay').default as overlayType
  },
  get OverlayParentHOC() {
    return require('./overlay/parent-hoc').default as typeof overlayparenthocType
  },
  get PhoneInput() {
    return require('./phone-input').default as typeof phoneinputType
  },
  get Placeholder() {
    return require('./placeholder').default as typeof placeholderType
  },
  get PlainInput() {
    return require('./plain-input').default as plaininputType
  },
  get PlatformIcon() {
    return require('./platform-icon').default as typeof platformiconType
  },
  get PopupDialog() {
    return require('./popup-dialog').default as popupdialogType
  },
  get PopupDialogHoc() {
    return require('./popup-dialog-hoc').default as typeof popupdialoghocType
  },
  get PopupHeaderText() {
    return require('./popup-header-text').default as typeof popupheadertextType
  },
  get PopupWrapper() {
    return require('./header-or-popup').PopupWrapper as typeof headerorpopupType
  },
  get ProfileCard() {
    return require('./profile-card').default as typeof profilecardType
  },
  get ProgressBar() {
    return require('./progress-bar').default as typeof progressbarType
  },
  get ProgressIndicator() {
    return require('./progress-indicator').default as progressindicatorType
  },
  get ProofBrokenBanner() {
    return require('./proof-broken-banner').default as typeof proofbrokenbannerType
  },
  get RadioButton() {
    return require('./radio-button').default as radiobuttonType
  },
  get Reloadable() {
    return require('./reload').default as typeof reloadType
  },
  get RequireImage() {
    return require('./image').RequireImage
  },
  get RichButton() {
    return require('./rich-button').default as typeof richbuttonType
  },
  get RoundedBox() {
    return require('./rounded-box').default as typeof roundedboxType
  },
  get SafeAreaView() {
    return require('./safe-area-view').default as safeareaviewType
  },
  get SafeAreaViewTop() {
    return require('./safe-area-view').SafeAreaViewTop
  },
  get SaveIndicator() {
    return require('./save-indicator').default as saveindicatorType
  },
  get ScrollView() {
    return require('./scroll-view').default as scrollviewType
  },
  get SearchFilter() {
    return require('./search-filter').default as searchfilterType
  },
  get SectionDivider() {
    return require('./section-divider').default as typeof sectiondividerType
  },
  get SectionList() {
    return require('./section-list').default as typeof sectionlistType
  },
  get SimpleToast() {
    return require('./simple-toast').default as typeof simpletoastType
  },
  get Switch() {
    return require('./switch').default as typeof switchType
  },
  get Tabs() {
    return require('./tabs').default as typeof tabsType
  },
  get TeamWithPopup() {
    return require('./team-with-popup/container').default as typeof teamwithpopupcontainerType
  },
  get Text() {
    return require('./text').default as textType
  },
  get TimelineMarker() {
    return require('./timeline-marker').default as typeof timelinemarkerType
  },
  get Toast() {
    return require('./toast').default as toastType
  },
  get Video() {
    return require('./video').default as videoType
  },
  get WaitingButton() {
    return require('./waiting-button').default as typeof waitingbuttonType
  },
  get WaveButton() {
    return require('./wave-button').default as typeof wavebuttonType
  },
  get WebView() {
    return require('./web-view').default as typeof webviewType
  },
  get WithTooltip() {
    return require('./with-tooltip').default as withtooltipType
  },
  get isValidIconType() {
    return require('./icon.shared').isValidIconType as typeof isValidIconTypeType
  },
  get largeListItem2Height() {
    return require('./list-item2').largeHeight as typeof largeHeightType
  },
  get smallListItem2Height() {
    return require('./list-item2').smallHeight as typeof smallHeightType
  },
  get urlsToImgSet() {
    return require('./icon').urlsToImgSet
  },
  get useHotKey() {
    return require('./hot-key').useHotKey
  },
  get useInterval() {
    return require('./use-timers').useInterval
  },
  get useModalHeaderTitleAndCancel() {
    return require('./modal/index').useModalHeaderTitleAndCancel
  },
  get useMounted() {
    return require('./use-mounted').default as typeof usemountedType
  },
  get usePopup() {
    return require('./use-popup').usePopup
  },
  get useSafeAreaInsets() {
    return require('./safe-area-view').useSafeAreaInsets
  },
  get useTimeout() {
    return require('./use-timers').useTimeout
  },
}
