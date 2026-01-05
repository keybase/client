// this is to defer actually importing these modules until you actually use them
// this file is ignored by ts
// Extract require to module scope to avoid HMR disposal issues with lazy getters
// When a module is disposed during HMR, getters that call require() can fail
// By extracting require to module scope, we avoid closure dependencies on the disposed module
const _require = (id) => require(id)
module.exports = {
  get Animation() {
    return _require('./animation').default
  },
  get Avatar() {
    return _require('./avatar').default
  },
  get AvatarLine() {
    return _require('./avatar/avatar-line').default
  },
  get BackButton() {
    return _require('./back-button').default
  },
  get Badge() {
    return _require('./badge').default
  },
  get Banner() {
    return _require('./banner').Banner
  },
  get BannerParagraph() {
    return _require('./banner').BannerParagraph
  },
  get BottomSheetBackdrop() {
    return _require('./bottom-sheet').BottomSheetBackdrop
  },
  get BottomSheetModal() {
    return _require('./bottom-sheet').BottomSheetModal
  },
  get BottomSheetScrollView() {
    return _require('./bottom-sheet').BottomSheetScrollView
  },
  get Box() {
    return _require('./box').default
  },
  get Box2() {
    return _require('./box').Box2
  },
  get Box2Animated() {
    return _require('./box').Box2Animated
  },
  get Box2Div() {
    return _require('./box').Box2Div
  },
  get Box2Measure() {
    return _require('./box').Box2Measure
  },
  get Box2View() {
    return _require('./box').Box2View
  },
  get BoxGrow() {
    return _require('./box-grow').default
  },
  get BoxGrow2() {
    return _require('./box-grow').BoxGrow2
  },
  get Button() {
    return _require('./button').default
  },
  get ButtonBar() {
    return _require('./button-bar').default
  },
  get CheckCircle() {
    return _require('./check-circle').default
  },
  get Checkbox() {
    return _require('./checkbox').default
  },
  get ChoiceList() {
    return _require('./choice-list').default
  },
  get ClickableBox() {
    return _require('./clickable-box').default
  },
  get ClickableBox2() {
    return _require('./clickable-box').ClickableBox2
  },
  get ConfirmModal() {
    return _require('./confirm-modal').default
  },
  get ConnectedNameWithIcon() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    _require('./profile-card').default

    return _require('./name-with-icon').default
  },
  get ConnectedUsernames() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    _require('./profile-card').default

    return _require('./usernames').default
  },
  get CopyText() {
    return _require('./copy-text').default
  },
  get CopyableText() {
    return _require('./copyable-text').default
  },
  get DelayedMounting() {
    return _require('./delayed-mounting').default
  },
  get Divider() {
    return _require('./divider').default
  },
  get DragAndDrop() {
    return _require('./drag-and-drop').default
  },
  get Dropdown() {
    return _require('./dropdown').default
  },
  get DropdownButton() {
    return _require('./dropdown').DropdownButton
  },
  get Emoji() {
    return _require('./emoji').default
  },
  get ErrorBoundary() {
    return _require('./error-boundary').default
  },
  get FloatingBox() {
    return _require('./floating-box').default
  },
  get FloatingMenu() {
    return _require('./floating-menu').default
  },
  get FloatingModalContext() {
    return _require('./floating-menu/context').FloatingModalContext
  },
  get FloatingPicker() {
    return _require('./floating-picker').default
  },
  get HeaderHocHeader() {
    return _require('./header-hoc').HeaderHocHeader
  },
  get HeaderHocWrapper() {
    return _require('./header-hoc').HeaderHocWrapper
  },
  get HeaderLeftBlank() {
    return _require('./header-hoc').HeaderLeftBlank
  },
  get HeaderLeftCancel() {
    return _require('./header-hoc').HeaderLeftCancel
  },
  get HotKey() {
    return _require('./hot-key').HotKey
  },
  get Icon() {
    return _require('./icon').default
  },
  get Image2() {
    return _require('./image2').default
  },
  get InfoNote() {
    return _require('./info-note').default
  },
  get InlineDropdown() {
    return _require('./dropdown').InlineDropdown
  },
  get Input2() {
    return _require('./input2').Input2
  },
  get KeyboardAvoidingView2() {
    return _require('./keyboard-avoiding-view').KeyboardAvoidingView2
  },
  get LabeledInput() {
    return _require('./labeled-input').default
  },
  get List() {
    return _require('./list').default
  },
  get List2() {
    return _require('./list2').default
  },
  get ListItem() {
    return _require('./list-item').default
  },
  get ListItem2() {
    return _require('./list-item2').default
  },
  get LoadingLine() {
    return _require('./loading-line').default
  },
  get Markdown() {
    return _require('./markdown').default
  },
  get Meta() {
    return _require('./meta').default
  },
  get MobilePopup() {
    return _require('./mobile-popup').default
  },
  get Modal() {
    return _require('./modal').default
  },
  get Modal2() {
    return _require('./modal2').default
  },
  get ModalHeader() {
    return _require('./modal').Header
  },
  get NameWithIcon() {
    return _require('./name-with-icon').default
  },
  get NativeEmoji() {
    return _require('./emoji/native-emoji').default
  },
  get NewInput() {
    return _require('./new-input').default
  },
  get Overlay() {
    return _require('./overlay').default
  },
  get PhoneInput() {
    return _require('./phone-input').default
  },
  get Placeholder() {
    return _require('./placeholder').default
  },
  get PlainInput() {
    return _require('./plain-input').default
  },
  get PlatformIcon() {
    return _require('./platform-icon').default
  },
  get PopupDialog() {
    return _require('./popup-dialog').default
  },
  get PopupHeaderText() {
    return _require('./popup-header-text').default
  },
  get PopupWrapper() {
    return _require('./header-or-popup').PopupWrapper
  },
  get ProfileCard() {
    return _require('./profile-card').default
  },
  get ProgressBar() {
    return _require('./progress-bar').default
  },
  get ProgressIndicator() {
    return _require('./progress-indicator').default
  },
  get ProofBrokenBanner() {
    return _require('./proof-broken-banner').default
  },
  get RadioButton() {
    return _require('./radio-button').default
  },
  get Reloadable() {
    return _require('./reload').default
  },
  get RichButton() {
    return _require('./rich-button').default
  },
  get RoundedBox() {
    return _require('./rounded-box').default
  },
  get SafeAreaView() {
    return _require('./safe-area-view').default
  },
  get SafeAreaViewTop() {
    return _require('./safe-area-view').SafeAreaViewTop
  },
  get SaveIndicator() {
    return _require('./save-indicator').default
  },
  get ScrollView() {
    return _require('./scroll-view').default
  },
  get SearchFilter() {
    return _require('./search-filter').default
  },
  get SectionDivider() {
    return _require('./section-divider').default
  },
  get SectionList() {
    return _require('./section-list').default
  },
  get SimpleToast() {
    return _require('./simple-toast').default
  },
  get Styles() {
    return _require('@/styles')
  },
  get Switch() {
    return _require('./switch').default
  },
  get Tabs() {
    return _require('./tabs').default
  },
  get TeamWithPopup() {
    return _require('./team-with-popup').default
  },
  get Text() {
    return _require('./text').default
  },
  get Text2() {
    return _require('./text2').Text2
  },
  get TimelineMarker() {
    return _require('./timeline-marker').default
  },
  get Toast() {
    return _require('./toast').default
  },
  get Video() {
    return _require('./video').default
  },
  get WaitingButton() {
    return _require('./waiting-button').default
  },
  get WaveButton() {
    return _require('./wave-button').default
  },
  get WebView() {
    return _require('./web-view').default
  },
  get WithTooltip() {
    return _require('./with-tooltip').default
  },
  get ZoomableImage() {
    return _require('./zoomable-image').default
  },
  get isValidIconType() {
    return _require('./icon.shared').isValidIconType
  },
  get largeListItem2Height() {
    return _require('./list-item2').largeHeight
  },
  get smallListItem2Height() {
    return _require('./list-item2').smallHeight
  },
  get urlsToImgSet() {
    return _require('./icon').urlsToImgSet
  },
  get useHotKey() {
    return _require('./hot-key').useHotKey
  },
  get useInterval() {
    return _require('./use-timers').useInterval
  },
  get useModalHeaderTitleAndCancel() {
    return _require('./modal').useModalHeaderTitleAndCancel
  },
  get usePopup2() {
    return _require('./use-popup').usePopup2
  },
  get useSafeAreaInsets() {
    return _require('./safe-area-view').useSafeAreaInsets
  },
  get useTimeout() {
    return _require('./use-timers').useTimeout
  },
}
