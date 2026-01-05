// this is to defer actually importing these modules until you actually use them
// this file is ignored by ts
// Cache required modules to avoid HMR disposal issues with lazy getters
const moduleCache = new Map()
const getCached = (id) => {
  if (!moduleCache.has(id)) {
    moduleCache.set(id, require(id))
  }
  return moduleCache.get(id)
}
module.exports = {
  get Animation() {
    return getCached('./animation').default
  },
  get Avatar() {
    return getCached('./avatar').default
  },
  get AvatarLine() {
    return getCached('./avatar/avatar-line').default
  },
  get BackButton() {
    return getCached('./back-button').default
  },
  get Badge() {
    return getCached('./badge').default
  },
  get Banner() {
    return getCached('./banner').Banner
  },
  get BannerParagraph() {
    return getCached('./banner').BannerParagraph
  },
  get BottomSheetBackdrop() {
    return getCached('./bottom-sheet').BottomSheetBackdrop
  },
  get BottomSheetModal() {
    return getCached('./bottom-sheet').BottomSheetModal
  },
  get BottomSheetScrollView() {
    return getCached('./bottom-sheet').BottomSheetScrollView
  },
  get Box() {
    return getCached('./box').default
  },
  get Box2() {
    return getCached('./box').Box2
  },
  get Box2Animated() {
    return getCached('./box').Box2Animated
  },
  get Box2Div() {
    return getCached('./box').Box2Div
  },
  get Box2Measure() {
    return getCached('./box').Box2Measure
  },
  get Box2View() {
    return getCached('./box').Box2View
  },
  get BoxGrow() {
    return getCached('./box-grow').default
  },
  get BoxGrow2() {
    return getCached('./box-grow').BoxGrow2
  },
  get Button() {
    return getCached('./button').default
  },
  get ButtonBar() {
    return getCached('./button-bar').default
  },
  get CheckCircle() {
    return getCached('./check-circle').default
  },
  get Checkbox() {
    return getCached('./checkbox').default
  },
  get ChoiceList() {
    return getCached('./choice-list').default
  },
  get ClickableBox() {
    return getCached('./clickable-box').default
  },
  get ClickableBox2() {
    return getCached('./clickable-box').ClickableBox2
  },
  get ConfirmModal() {
    return getCached('./confirm-modal').default
  },
  get ConnectedNameWithIcon() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    getCached('./profile-card').default

    return getCached('./name-with-icon').default
  },
  get ConnectedUsernames() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    getCached('./profile-card').default

    return getCached('./usernames').default
  },
  get CopyText() {
    return getCached('./copy-text').default
  },
  get CopyableText() {
    return getCached('./copyable-text').default
  },
  get DelayedMounting() {
    return getCached('./delayed-mounting').default
  },
  get Divider() {
    return getCached('./divider').default
  },
  get DragAndDrop() {
    return getCached('./drag-and-drop').default
  },
  get Dropdown() {
    return getCached('./dropdown').default
  },
  get DropdownButton() {
    return getCached('./dropdown').DropdownButton
  },
  get Emoji() {
    return getCached('./emoji').default
  },
  get ErrorBoundary() {
    return getCached('./error-boundary').default
  },
  get FloatingBox() {
    return getCached('./floating-box').default
  },
  get FloatingMenu() {
    return getCached('./floating-menu').default
  },
  get FloatingModalContext() {
    return getCached('./floating-menu/context').FloatingModalContext
  },
  get FloatingPicker() {
    return getCached('./floating-picker').default
  },
  get HeaderHocHeader() {
    return getCached('./header-hoc').HeaderHocHeader
  },
  get HeaderHocWrapper() {
    return getCached('./header-hoc').HeaderHocWrapper
  },
  get HeaderLeftBlank() {
    return getCached('./header-hoc').HeaderLeftBlank
  },
  get HeaderLeftCancel() {
    return getCached('./header-hoc').HeaderLeftCancel
  },
  get HotKey() {
    return getCached('./hot-key').HotKey
  },
  get Icon() {
    return getCached('./icon').default
  },
  get Image2() {
    return getCached('./image2').default
  },
  get InfoNote() {
    return getCached('./info-note').default
  },
  get InlineDropdown() {
    return getCached('./dropdown').InlineDropdown
  },
  get Input2() {
    return getCached('./input2').Input2
  },
  get KeyboardAvoidingView2() {
    return getCached('./keyboard-avoiding-view').KeyboardAvoidingView2
  },
  get LabeledInput() {
    return getCached('./labeled-input').default
  },
  get List() {
    return getCached('./list').default
  },
  get List2() {
    return getCached('./list2').default
  },
  get ListItem() {
    return getCached('./list-item').default
  },
  get ListItem2() {
    return getCached('./list-item2').default
  },
  get LoadingLine() {
    return getCached('./loading-line').default
  },
  get Markdown() {
    return getCached('./markdown').default
  },
  get Meta() {
    return getCached('./meta').default
  },
  get MobilePopup() {
    return getCached('./mobile-popup').default
  },
  get Modal() {
    return getCached('./modal').default
  },
  get Modal2() {
    return getCached('./modal2').default
  },
  get ModalHeader() {
    return getCached('./modal').Header
  },
  get NameWithIcon() {
    return getCached('./name-with-icon').default
  },
  get NativeEmoji() {
    return getCached('./emoji/native-emoji').default
  },
  get NewInput() {
    return getCached('./new-input').default
  },
  get Overlay() {
    return getCached('./overlay').default
  },
  get PhoneInput() {
    return getCached('./phone-input').default
  },
  get Placeholder() {
    return getCached('./placeholder').default
  },
  get PlainInput() {
    return getCached('./plain-input').default
  },
  get PlatformIcon() {
    return getCached('./platform-icon').default
  },
  get PopupDialog() {
    return getCached('./popup-dialog').default
  },
  get PopupHeaderText() {
    return getCached('./popup-header-text').default
  },
  get PopupWrapper() {
    return getCached('./header-or-popup').PopupWrapper
  },
  get ProfileCard() {
    return getCached('./profile-card').default
  },
  get ProgressBar() {
    return getCached('./progress-bar').default
  },
  get ProgressIndicator() {
    return getCached('./progress-indicator').default
  },
  get ProofBrokenBanner() {
    return getCached('./proof-broken-banner').default
  },
  get RadioButton() {
    return getCached('./radio-button').default
  },
  get Reloadable() {
    return getCached('./reload').default
  },
  get RichButton() {
    return getCached('./rich-button').default
  },
  get RoundedBox() {
    return getCached('./rounded-box').default
  },
  get SafeAreaView() {
    return getCached('./safe-area-view').default
  },
  get SafeAreaViewTop() {
    return getCached('./safe-area-view').SafeAreaViewTop
  },
  get SaveIndicator() {
    return getCached('./save-indicator').default
  },
  get ScrollView() {
    return getCached('./scroll-view').default
  },
  get SearchFilter() {
    return getCached('./search-filter').default
  },
  get SectionDivider() {
    return getCached('./section-divider').default
  },
  get SectionList() {
    return getCached('./section-list').default
  },
  get SimpleToast() {
    return getCached('./simple-toast').default
  },
  get Styles() {
    return getCached('@/styles')
  },
  get Switch() {
    return getCached('./switch').default
  },
  get Tabs() {
    return getCached('./tabs').default
  },
  get TeamWithPopup() {
    return getCached('./team-with-popup').default
  },
  get Text() {
    return getCached('./text').default
  },
  get Text2() {
    return getCached('./text2').Text2
  },
  get TimelineMarker() {
    return getCached('./timeline-marker').default
  },
  get Toast() {
    return getCached('./toast').default
  },
  get Video() {
    return getCached('./video').default
  },
  get WaitingButton() {
    return getCached('./waiting-button').default
  },
  get WaveButton() {
    return getCached('./wave-button').default
  },
  get WebView() {
    return getCached('./web-view').default
  },
  get WithTooltip() {
    return getCached('./with-tooltip').default
  },
  get ZoomableImage() {
    return getCached('./zoomable-image').default
  },
  get isValidIconType() {
    return getCached('./icon.shared').isValidIconType
  },
  get largeListItem2Height() {
    return getCached('./list-item2').largeHeight
  },
  get smallListItem2Height() {
    return getCached('./list-item2').smallHeight
  },
  get urlsToImgSet() {
    return getCached('./icon').urlsToImgSet
  },
  get useHotKey() {
    return getCached('./hot-key').useHotKey
  },
  get useInterval() {
    return getCached('./use-timers').useInterval
  },
  get useModalHeaderTitleAndCancel() {
    return getCached('./modal').useModalHeaderTitleAndCancel
  },
  get usePopup2() {
    return getCached('./use-popup').usePopup2
  },
  get useSafeAreaInsets() {
    return getCached('./safe-area-view').useSafeAreaInsets
  },
  get useTimeout() {
    return getCached('./use-timers').useTimeout
  },
}
