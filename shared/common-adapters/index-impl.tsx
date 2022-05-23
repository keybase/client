// @ts-nocheck
/* eslint-disable */
module.exports = {
  get Animation() {
    return require('./animation').default
  },
  get Avatar() {
    return require('./avatar').default
  },
  get AvatarLine() {
    return require('./avatar-line').default
  },
  get BackButton() {
    return require('./back-button').default
  },
  get BackgroundRepeatBox() {
    return require('./background-repeat-box').default
  },
  get Badge() {
    return require('./badge').default
  },
  get Banner() {
    return require('./banner').Banner
  },
  get BannerParagraph() {
    return require('./banner').BannerParagraph
  },
  get Box() {
    return require('./box').default
  },
  get Box2() {
    return require('./box').Box2
  },
  get BoxGrow() {
    return require('./box-grow').default
  },
  get Button() {
    return require('./button').default
  },
  get ButtonBar() {
    return require('./button-bar').default
  },
  get CheckCircle() {
    return require('./check-circle').default
  },
  get Checkbox() {
    return require('./checkbox').default
  },
  get ChoiceList() {
    return require('./choice-list').default
  },
  get ClickableBox() {
    return require('./clickable-box').default
  },
  get ConfirmModal() {
    return require('./confirm-modal/index').default
  },
  get ConnectedNameWithIcon() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    require('./profile-card').default

    return require('./name-with-icon/container').default
  },
  get ConnectedUsernames() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    require('./profile-card').default

    return require('./usernames').default
  },
  get CopyText() {
    return require('./copy-text').default
  },
  get CopyableText() {
    return require('./copyable-text').default
  },
  get CustomEmoji() {
    return require('./custom-emoji').default
  },
  get DelayedMounting() {
    return require('./delayed-mounting').default
  },
  get DesktopStyle() {
    return require('./desktop-style').default
  },
  get Divider() {
    return require('./divider').default
  },
  get DragAndDrop() {
    return require('./drag-and-drop').default
  },
  get Dropdown() {
    return require('./dropdown').default
  },
  get DropdownButton() {
    return require('./dropdown').DropdownButton
  },
  get Emoji() {
    return require('./emoji').default
  },
  get EmojiIfExists() {
    return require('./markdown/react').EmojiIfExists
  },
  get ErrorBoundary() {
    return require('./error-boundary').default
  },
  get FloatingBox() {
    return require('./floating-box').default
  },
  get FloatingMenu() {
    return require('./floating-menu').default
  },
  get FloatingPicker() {
    return require('./floating-picker').default
  },
  get HeaderHocHeader() {
    return require('./header-hoc').HeaderHocHeader
  },
  get HeaderHocWrapper() {
    return require('./header-hoc').HeaderHocWrapper
  },
  get HeaderLeftBlank() {
    return require('./header-hoc').HeaderLeftBlank
  },
  get HeaderLeftCancel() {
    return require('./header-hoc').HeaderLeftCancel
  },
  get HotKey() {
    return require('./hot-key').HotKey
  },
  get HoverHoc() {
    return require('./hover-hoc').default
  },
  get Icon() {
    return require('./icon').default
  },
  get Image() {
    return require('./image').default
  },
  get InfoNote() {
    return require('./info-note').default
  },
  get InlineDropdown() {
    return require('./dropdown').InlineDropdown
  },
  get Input() {
    return require('./input').default
  },
  get KeyboardAvoidingView() {
    return require('./keyboard-avoiding-view').default
  },
  get LabeledInput() {
    return require('./labeled-input').default
  },
  get List() {
    return require('./list').default
  },
  get List2() {
    return require('./list2').default
  },
  get ListItem() {
    return require('./list-item').default
  },
  get ListItem2() {
    return require('./list-item2').default
  },
  get LoadingLine() {
    return require('./loading-line').default
  },
  get Markdown() {
    return require('./markdown').default
  },
  get MaybePopup() {
    return require('./maybe-popup').MaybePopup
  },
  get Meta() {
    return require('./meta').default
  },
  get MobilePopup() {
    return require('./mobile-popup').default
  },
  get Modal() {
    return require('./modal').default
  },
  get Modal2() {
    return require('./modal2').default
  },
  get ModalHeader() {
    return require('./modal').Header
  },
  get MultiAvatar() {
    return require('./multi-avatar').default
  },
  get NameWithIcon() {
    return require('./name-with-icon').default
  },
  get NewInput() {
    return require('./new-input').default
  },
  get Overlay() {
    return require('./overlay').default
  },
  get OverlayParentHOC() {
    return require('./overlay/parent-hoc').default
  },
  get PhoneInput() {
    return require('./phone-input').default
  },
  get Placeholder() {
    return require('./placeholder').default
  },
  get PlainInput() {
    return require('./plain-input').default
  },
  get PlatformIcon() {
    return require('./platform-icon').default
  },
  get PopupDialog() {
    return require('./popup-dialog').default
  },
  get PopupDialogHoc() {
    return require('./popup-dialog-hoc').default
  },
  get PopupHeaderText() {
    return require('./popup-header-text').default
  },
  get PopupWrapper() {
    return require('./header-or-popup').PopupWrapper
  },
  get ProfileCard() {
    return require('./profile-card').default
  },
  get ProgressBar() {
    return require('./progress-bar').default
  },
  get ProgressIndicator() {
    return require('./progress-indicator').default
  },
  get ProofBrokenBanner() {
    return require('./proof-broken-banner').default
  },
  get RadioButton() {
    return require('./radio-button').default
  },
  get Reloadable() {
    return require('./reload').default
  },
  get RequireImage() {
    return require('./image').RequireImage
  },
  get RichButton() {
    return require('./rich-button').default
  },
  get RoundedBox() {
    return require('./rounded-box').default
  },
  get SafeAreaView() {
    return require('./safe-area-view').default
  },
  get SafeAreaViewTop() {
    return require('./safe-area-view').SafeAreaViewTop
  },
  get SaveIndicator() {
    return require('./save-indicator').default
  },
  get ScrollView() {
    return require('./scroll-view').default
  },
  get SearchFilter() {
    return require('./search-filter').default
  },
  get SectionDivider() {
    return require('./section-divider').default
  },
  get SectionList() {
    return require('./section-list').default
  },
  get SimpleToast() {
    return require('./simple-toast').default
  },
  get Switch() {
    return require('./switch').default
  },
  get Tabs() {
    return require('./tabs').default
  },
  get TeamWithPopup() {
    return require('./team-with-popup/container').default
  },
  get Text() {
    return require('./text').default
  },
  get TimelineMarker() {
    return require('./timeline-marker').default
  },
  get Toast() {
    return require('./toast').default
  },
  get Video() {
    return require('./video').default
  },
  get WaitingButton() {
    return require('./waiting-button').default
  },
  get WaveButton() {
    return require('./wave-button').default
  },
  get WebView() {
    return require('./web-view').default
  },
  get WithTooltip() {
    return require('./with-tooltip').default
  },
  get isValidIconType() {
    return require('./icon.shared').isValidIconType
  },
  get largeListItem2Height() {
    return require('./list-item2').largeHeight
  },
  get smallListItem2Height() {
    return require('./list-item2').smallHeight
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
    return require('./use-mounted').default
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
