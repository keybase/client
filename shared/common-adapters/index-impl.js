// this is to defer actually importing these modules until you actually use them
// this file is ignored by ts
// Cache required modules to avoid HMR disposal issues with lazy getters
const moduleCache = new Map()
module.exports = {
  get Animation() {
    if (!moduleCache.has('./animation')) {
      moduleCache.set('./animation', require('./animation'))
    }
    return moduleCache.get('./animation').default
  },
  get Avatar() {
    if (!moduleCache.has('./avatar')) {
      moduleCache.set('./avatar', require('./avatar'))
    }
    return moduleCache.get('./avatar').default
  },
  get AvatarLine() {
    if (!moduleCache.has('./avatar/avatar-line')) {
      moduleCache.set('./avatar/avatar-line', require('./avatar/avatar-line'))
    }
    return moduleCache.get('./avatar/avatar-line').default
  },
  get BackButton() {
    if (!moduleCache.has('./back-button')) {
      moduleCache.set('./back-button', require('./back-button'))
    }
    return moduleCache.get('./back-button').default
  },
  get Badge() {
    if (!moduleCache.has('./badge')) {
      moduleCache.set('./badge', require('./badge'))
    }
    return moduleCache.get('./badge').default
  },
  get Banner() {
    if (!moduleCache.has('./banner')) {
      moduleCache.set('./banner', require('./banner'))
    }
    return moduleCache.get('./banner').Banner
  },
  get BannerParagraph() {
    if (!moduleCache.has('./banner')) {
      moduleCache.set('./banner', require('./banner'))
    }
    return moduleCache.get('./banner').BannerParagraph
  },
  get BottomSheetBackdrop() {
    if (!moduleCache.has('./bottom-sheet')) {
      moduleCache.set('./bottom-sheet', require('./bottom-sheet'))
    }
    return moduleCache.get('./bottom-sheet').BottomSheetBackdrop
  },
  get BottomSheetModal() {
    if (!moduleCache.has('./bottom-sheet')) {
      moduleCache.set('./bottom-sheet', require('./bottom-sheet'))
    }
    return moduleCache.get('./bottom-sheet').BottomSheetModal
  },
  get BottomSheetScrollView() {
    if (!moduleCache.has('./bottom-sheet')) {
      moduleCache.set('./bottom-sheet', require('./bottom-sheet'))
    }
    return moduleCache.get('./bottom-sheet').BottomSheetScrollView
  },
  get Box() {
    if (!moduleCache.has('./box')) {
      moduleCache.set('./box', require('./box'))
    }
    return moduleCache.get('./box').default
  },
  get Box2() {
    if (!moduleCache.has('./box')) {
      moduleCache.set('./box', require('./box'))
    }
    return moduleCache.get('./box').Box2
  },
  get Box2Animated() {
    if (!moduleCache.has('./box')) {
      moduleCache.set('./box', require('./box'))
    }
    return moduleCache.get('./box').Box2Animated
  },
  get Box2Div() {
    if (!moduleCache.has('./box')) {
      moduleCache.set('./box', require('./box'))
    }
    return moduleCache.get('./box').Box2Div
  },
  get Box2Measure() {
    if (!moduleCache.has('./box')) {
      moduleCache.set('./box', require('./box'))
    }
    return moduleCache.get('./box').Box2Measure
  },
  get Box2View() {
    if (!moduleCache.has('./box')) {
      moduleCache.set('./box', require('./box'))
    }
    return moduleCache.get('./box').Box2View
  },
  get BoxGrow() {
    if (!moduleCache.has('./box-grow')) {
      moduleCache.set('./box-grow', require('./box-grow'))
    }
    return moduleCache.get('./box-grow').default
  },
  get BoxGrow2() {
    if (!moduleCache.has('./box-grow')) {
      moduleCache.set('./box-grow', require('./box-grow'))
    }
    return moduleCache.get('./box-grow').BoxGrow2
  },
  get Button() {
    if (!moduleCache.has('./button')) {
      moduleCache.set('./button', require('./button'))
    }
    return moduleCache.get('./button').default
  },
  get ButtonBar() {
    if (!moduleCache.has('./button-bar')) {
      moduleCache.set('./button-bar', require('./button-bar'))
    }
    return moduleCache.get('./button-bar').default
  },
  get CheckCircle() {
    if (!moduleCache.has('./check-circle')) {
      moduleCache.set('./check-circle', require('./check-circle'))
    }
    return moduleCache.get('./check-circle').default
  },
  get Checkbox() {
    if (!moduleCache.has('./checkbox')) {
      moduleCache.set('./checkbox', require('./checkbox'))
    }
    return moduleCache.get('./checkbox').default
  },
  get ChoiceList() {
    if (!moduleCache.has('./choice-list')) {
      moduleCache.set('./choice-list', require('./choice-list'))
    }
    return moduleCache.get('./choice-list').default
  },
  get ClickableBox() {
    if (!moduleCache.has('./clickable-box')) {
      moduleCache.set('./clickable-box', require('./clickable-box'))
    }
    return moduleCache.get('./clickable-box').default
  },
  get ClickableBox2() {
    if (!moduleCache.has('./clickable-box')) {
      moduleCache.set('./clickable-box', require('./clickable-box'))
    }
    return moduleCache.get('./clickable-box').ClickableBox2
  },
  get ConfirmModal() {
    if (!moduleCache.has('./confirm-modal')) {
      moduleCache.set('./confirm-modal', require('./confirm-modal'))
    }
    return moduleCache.get('./confirm-modal').default
  },
  get ConnectedNameWithIcon() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    if (!moduleCache.has('./profile-card')) {
      moduleCache.set('./profile-card', require('./profile-card'))
    }
    moduleCache.get('./profile-card').default

    if (!moduleCache.has('./name-with-icon')) {
      moduleCache.set('./name-with-icon', require('./name-with-icon'))
    }
    return moduleCache.get('./name-with-icon').default
  },
  get ConnectedUsernames() {
    // explicitly require this to make popup work if it's not been imported
    // explicitly
    if (!moduleCache.has('./profile-card')) {
      moduleCache.set('./profile-card', require('./profile-card'))
    }
    moduleCache.get('./profile-card').default

    if (!moduleCache.has('./usernames')) {
      moduleCache.set('./usernames', require('./usernames'))
    }
    return moduleCache.get('./usernames').default
  },
  get CopyText() {
    if (!moduleCache.has('./copy-text')) {
      moduleCache.set('./copy-text', require('./copy-text'))
    }
    return moduleCache.get('./copy-text').default
  },
  get CopyableText() {
    if (!moduleCache.has('./copyable-text')) {
      moduleCache.set('./copyable-text', require('./copyable-text'))
    }
    return moduleCache.get('./copyable-text').default
  },
  get DelayedMounting() {
    if (!moduleCache.has('./delayed-mounting')) {
      moduleCache.set('./delayed-mounting', require('./delayed-mounting'))
    }
    return moduleCache.get('./delayed-mounting').default
  },
  get Divider() {
    if (!moduleCache.has('./divider')) {
      moduleCache.set('./divider', require('./divider'))
    }
    return moduleCache.get('./divider').default
  },
  get DragAndDrop() {
    if (!moduleCache.has('./drag-and-drop')) {
      moduleCache.set('./drag-and-drop', require('./drag-and-drop'))
    }
    return moduleCache.get('./drag-and-drop').default
  },
  get Dropdown() {
    if (!moduleCache.has('./dropdown')) {
      moduleCache.set('./dropdown', require('./dropdown'))
    }
    return moduleCache.get('./dropdown').default
  },
  get DropdownButton() {
    if (!moduleCache.has('./dropdown')) {
      moduleCache.set('./dropdown', require('./dropdown'))
    }
    return moduleCache.get('./dropdown').DropdownButton
  },
  get Emoji() {
    if (!moduleCache.has('./emoji')) {
      moduleCache.set('./emoji', require('./emoji'))
    }
    return moduleCache.get('./emoji').default
  },
  get ErrorBoundary() {
    if (!moduleCache.has('./error-boundary')) {
      moduleCache.set('./error-boundary', require('./error-boundary'))
    }
    return moduleCache.get('./error-boundary').default
  },
  get FloatingBox() {
    if (!moduleCache.has('./floating-box')) {
      moduleCache.set('./floating-box', require('./floating-box'))
    }
    return moduleCache.get('./floating-box').default
  },
  get FloatingMenu() {
    if (!moduleCache.has('./floating-menu')) {
      moduleCache.set('./floating-menu', require('./floating-menu'))
    }
    return moduleCache.get('./floating-menu').default
  },
  get FloatingModalContext() {
    if (!moduleCache.has('./floating-menu/context')) {
      moduleCache.set('./floating-menu/context', require('./floating-menu/context'))
    }
    return moduleCache.get('./floating-menu/context').FloatingModalContext
  },
  get FloatingPicker() {
    if (!moduleCache.has('./floating-picker')) {
      moduleCache.set('./floating-picker', require('./floating-picker'))
    }
    return moduleCache.get('./floating-picker').default
  },
  get HeaderHocHeader() {
    if (!moduleCache.has('./header-hoc')) {
      moduleCache.set('./header-hoc', require('./header-hoc'))
    }
    return moduleCache.get('./header-hoc').HeaderHocHeader
  },
  get HeaderHocWrapper() {
    if (!moduleCache.has('./header-hoc')) {
      moduleCache.set('./header-hoc', require('./header-hoc'))
    }
    return moduleCache.get('./header-hoc').HeaderHocWrapper
  },
  get HeaderLeftBlank() {
    if (!moduleCache.has('./header-hoc')) {
      moduleCache.set('./header-hoc', require('./header-hoc'))
    }
    return moduleCache.get('./header-hoc').HeaderLeftBlank
  },
  get HeaderLeftCancel() {
    if (!moduleCache.has('./header-hoc')) {
      moduleCache.set('./header-hoc', require('./header-hoc'))
    }
    return moduleCache.get('./header-hoc').HeaderLeftCancel
  },
  get HotKey() {
    if (!moduleCache.has('./hot-key')) {
      moduleCache.set('./hot-key', require('./hot-key'))
    }
    return moduleCache.get('./hot-key').HotKey
  },
  get Icon() {
    if (!moduleCache.has('./icon')) {
      moduleCache.set('./icon', require('./icon'))
    }
    return moduleCache.get('./icon').default
  },
  get Image2() {
    if (!moduleCache.has('./image2')) {
      moduleCache.set('./image2', require('./image2'))
    }
    return moduleCache.get('./image2').default
  },
  get InfoNote() {
    if (!moduleCache.has('./info-note')) {
      moduleCache.set('./info-note', require('./info-note'))
    }
    return moduleCache.get('./info-note').default
  },
  get InlineDropdown() {
    if (!moduleCache.has('./dropdown')) {
      moduleCache.set('./dropdown', require('./dropdown'))
    }
    return moduleCache.get('./dropdown').InlineDropdown
  },
  get Input2() {
    if (!moduleCache.has('./input2')) {
      moduleCache.set('./input2', require('./input2'))
    }
    return moduleCache.get('./input2').Input2
  },
  get KeyboardAvoidingView2() {
    if (!moduleCache.has('./keyboard-avoiding-view')) {
      moduleCache.set('./keyboard-avoiding-view', require('./keyboard-avoiding-view'))
    }
    return moduleCache.get('./keyboard-avoiding-view').KeyboardAvoidingView2
  },
  get LabeledInput() {
    if (!moduleCache.has('./labeled-input')) {
      moduleCache.set('./labeled-input', require('./labeled-input'))
    }
    return moduleCache.get('./labeled-input').default
  },
  get List() {
    if (!moduleCache.has('./list')) {
      moduleCache.set('./list', require('./list'))
    }
    return moduleCache.get('./list').default
  },
  get List2() {
    if (!moduleCache.has('./list2')) {
      moduleCache.set('./list2', require('./list2'))
    }
    return moduleCache.get('./list2').default
  },
  get ListItem() {
    if (!moduleCache.has('./list-item')) {
      moduleCache.set('./list-item', require('./list-item'))
    }
    return moduleCache.get('./list-item').default
  },
  get ListItem2() {
    if (!moduleCache.has('./list-item2')) {
      moduleCache.set('./list-item2', require('./list-item2'))
    }
    return moduleCache.get('./list-item2').default
  },
  get LoadingLine() {
    if (!moduleCache.has('./loading-line')) {
      moduleCache.set('./loading-line', require('./loading-line'))
    }
    return moduleCache.get('./loading-line').default
  },
  get Markdown() {
    if (!moduleCache.has('./markdown')) {
      moduleCache.set('./markdown', require('./markdown'))
    }
    return moduleCache.get('./markdown').default
  },
  get Meta() {
    if (!moduleCache.has('./meta')) {
      moduleCache.set('./meta', require('./meta'))
    }
    return moduleCache.get('./meta').default
  },
  get MobilePopup() {
    if (!moduleCache.has('./mobile-popup')) {
      moduleCache.set('./mobile-popup', require('./mobile-popup'))
    }
    return moduleCache.get('./mobile-popup').default
  },
  get Modal() {
    if (!moduleCache.has('./modal')) {
      moduleCache.set('./modal', require('./modal'))
    }
    return moduleCache.get('./modal').default
  },
  get Modal2() {
    if (!moduleCache.has('./modal2')) {
      moduleCache.set('./modal2', require('./modal2'))
    }
    return moduleCache.get('./modal2').default
  },
  get ModalHeader() {
    if (!moduleCache.has('./modal')) {
      moduleCache.set('./modal', require('./modal'))
    }
    return moduleCache.get('./modal').Header
  },
  get NameWithIcon() {
    if (!moduleCache.has('./name-with-icon')) {
      moduleCache.set('./name-with-icon', require('./name-with-icon'))
    }
    return moduleCache.get('./name-with-icon').default
  },
  get NativeEmoji() {
    if (!moduleCache.has('./emoji/native-emoji')) {
      moduleCache.set('./emoji/native-emoji', require('./emoji/native-emoji'))
    }
    return moduleCache.get('./emoji/native-emoji').default
  },
  get NewInput() {
    if (!moduleCache.has('./new-input')) {
      moduleCache.set('./new-input', require('./new-input'))
    }
    return moduleCache.get('./new-input').default
  },
  get Overlay() {
    if (!moduleCache.has('./overlay')) {
      moduleCache.set('./overlay', require('./overlay'))
    }
    return moduleCache.get('./overlay').default
  },
  get PhoneInput() {
    if (!moduleCache.has('./phone-input')) {
      moduleCache.set('./phone-input', require('./phone-input'))
    }
    return moduleCache.get('./phone-input').default
  },
  get Placeholder() {
    if (!moduleCache.has('./placeholder')) {
      moduleCache.set('./placeholder', require('./placeholder'))
    }
    return moduleCache.get('./placeholder').default
  },
  get PlainInput() {
    if (!moduleCache.has('./plain-input')) {
      moduleCache.set('./plain-input', require('./plain-input'))
    }
    return moduleCache.get('./plain-input').default
  },
  get PlatformIcon() {
    if (!moduleCache.has('./platform-icon')) {
      moduleCache.set('./platform-icon', require('./platform-icon'))
    }
    return moduleCache.get('./platform-icon').default
  },
  get PopupDialog() {
    if (!moduleCache.has('./popup-dialog')) {
      moduleCache.set('./popup-dialog', require('./popup-dialog'))
    }
    return moduleCache.get('./popup-dialog').default
  },
  get PopupHeaderText() {
    if (!moduleCache.has('./popup-header-text')) {
      moduleCache.set('./popup-header-text', require('./popup-header-text'))
    }
    return moduleCache.get('./popup-header-text').default
  },
  get PopupWrapper() {
    if (!moduleCache.has('./header-or-popup')) {
      moduleCache.set('./header-or-popup', require('./header-or-popup'))
    }
    return moduleCache.get('./header-or-popup').PopupWrapper
  },
  get ProfileCard() {
    if (!moduleCache.has('./profile-card')) {
      moduleCache.set('./profile-card', require('./profile-card'))
    }
    return moduleCache.get('./profile-card').default
  },
  get ProgressBar() {
    if (!moduleCache.has('./progress-bar')) {
      moduleCache.set('./progress-bar', require('./progress-bar'))
    }
    return moduleCache.get('./progress-bar').default
  },
  get ProgressIndicator() {
    if (!moduleCache.has('./progress-indicator')) {
      moduleCache.set('./progress-indicator', require('./progress-indicator'))
    }
    return moduleCache.get('./progress-indicator').default
  },
  get ProofBrokenBanner() {
    if (!moduleCache.has('./proof-broken-banner')) {
      moduleCache.set('./proof-broken-banner', require('./proof-broken-banner'))
    }
    return moduleCache.get('./proof-broken-banner').default
  },
  get RadioButton() {
    if (!moduleCache.has('./radio-button')) {
      moduleCache.set('./radio-button', require('./radio-button'))
    }
    return moduleCache.get('./radio-button').default
  },
  get Reloadable() {
    if (!moduleCache.has('./reload')) {
      moduleCache.set('./reload', require('./reload'))
    }
    return moduleCache.get('./reload').default
  },
  get RichButton() {
    if (!moduleCache.has('./rich-button')) {
      moduleCache.set('./rich-button', require('./rich-button'))
    }
    return moduleCache.get('./rich-button').default
  },
  get RoundedBox() {
    if (!moduleCache.has('./rounded-box')) {
      moduleCache.set('./rounded-box', require('./rounded-box'))
    }
    return moduleCache.get('./rounded-box').default
  },
  get SafeAreaView() {
    if (!moduleCache.has('./safe-area-view')) {
      moduleCache.set('./safe-area-view', require('./safe-area-view'))
    }
    return moduleCache.get('./safe-area-view').default
  },
  get SafeAreaViewTop() {
    if (!moduleCache.has('./safe-area-view')) {
      moduleCache.set('./safe-area-view', require('./safe-area-view'))
    }
    return moduleCache.get('./safe-area-view').SafeAreaViewTop
  },
  get SaveIndicator() {
    if (!moduleCache.has('./save-indicator')) {
      moduleCache.set('./save-indicator', require('./save-indicator'))
    }
    return moduleCache.get('./save-indicator').default
  },
  get ScrollView() {
    if (!moduleCache.has('./scroll-view')) {
      moduleCache.set('./scroll-view', require('./scroll-view'))
    }
    return moduleCache.get('./scroll-view').default
  },
  get SearchFilter() {
    if (!moduleCache.has('./search-filter')) {
      moduleCache.set('./search-filter', require('./search-filter'))
    }
    return moduleCache.get('./search-filter').default
  },
  get SectionDivider() {
    if (!moduleCache.has('./section-divider')) {
      moduleCache.set('./section-divider', require('./section-divider'))
    }
    return moduleCache.get('./section-divider').default
  },
  get SectionList() {
    if (!moduleCache.has('./section-list')) {
      moduleCache.set('./section-list', require('./section-list'))
    }
    return moduleCache.get('./section-list').default
  },
  get SimpleToast() {
    if (!moduleCache.has('./simple-toast')) {
      moduleCache.set('./simple-toast', require('./simple-toast'))
    }
    return moduleCache.get('./simple-toast').default
  },
  get Styles() {
    if (!moduleCache.has('@/styles')) {
      moduleCache.set('@/styles', require('@/styles'))
    }
    return moduleCache.get('@/styles')
  },
  get Switch() {
    if (!moduleCache.has('./switch')) {
      moduleCache.set('./switch', require('./switch'))
    }
    return moduleCache.get('./switch').default
  },
  get Tabs() {
    if (!moduleCache.has('./tabs')) {
      moduleCache.set('./tabs', require('./tabs'))
    }
    return moduleCache.get('./tabs').default
  },
  get TeamWithPopup() {
    if (!moduleCache.has('./team-with-popup')) {
      moduleCache.set('./team-with-popup', require('./team-with-popup'))
    }
    return moduleCache.get('./team-with-popup').default
  },
  get Text() {
    if (!moduleCache.has('./text')) {
      moduleCache.set('./text', require('./text'))
    }
    return moduleCache.get('./text').default
  },
  get Text2() {
    if (!moduleCache.has('./text2')) {
      moduleCache.set('./text2', require('./text2'))
    }
    return moduleCache.get('./text2').Text2
  },
  get TimelineMarker() {
    if (!moduleCache.has('./timeline-marker')) {
      moduleCache.set('./timeline-marker', require('./timeline-marker'))
    }
    return moduleCache.get('./timeline-marker').default
  },
  get Toast() {
    if (!moduleCache.has('./toast')) {
      moduleCache.set('./toast', require('./toast'))
    }
    return moduleCache.get('./toast').default
  },
  get Video() {
    if (!moduleCache.has('./video')) {
      moduleCache.set('./video', require('./video'))
    }
    return moduleCache.get('./video').default
  },
  get WaitingButton() {
    if (!moduleCache.has('./waiting-button')) {
      moduleCache.set('./waiting-button', require('./waiting-button'))
    }
    return moduleCache.get('./waiting-button').default
  },
  get WaveButton() {
    if (!moduleCache.has('./wave-button')) {
      moduleCache.set('./wave-button', require('./wave-button'))
    }
    return moduleCache.get('./wave-button').default
  },
  get WebView() {
    if (!moduleCache.has('./web-view')) {
      moduleCache.set('./web-view', require('./web-view'))
    }
    return moduleCache.get('./web-view').default
  },
  get WithTooltip() {
    if (!moduleCache.has('./with-tooltip')) {
      moduleCache.set('./with-tooltip', require('./with-tooltip'))
    }
    return moduleCache.get('./with-tooltip').default
  },
  get ZoomableImage() {
    if (!moduleCache.has('./zoomable-image')) {
      moduleCache.set('./zoomable-image', require('./zoomable-image'))
    }
    return moduleCache.get('./zoomable-image').default
  },
  get isValidIconType() {
    if (!moduleCache.has('./icon.shared')) {
      moduleCache.set('./icon.shared', require('./icon.shared'))
    }
    return moduleCache.get('./icon.shared').isValidIconType
  },
  get largeListItem2Height() {
    if (!moduleCache.has('./list-item2')) {
      moduleCache.set('./list-item2', require('./list-item2'))
    }
    return moduleCache.get('./list-item2').largeHeight
  },
  get smallListItem2Height() {
    if (!moduleCache.has('./list-item2')) {
      moduleCache.set('./list-item2', require('./list-item2'))
    }
    return moduleCache.get('./list-item2').smallHeight
  },
  get urlsToImgSet() {
    if (!moduleCache.has('./icon')) {
      moduleCache.set('./icon', require('./icon'))
    }
    return moduleCache.get('./icon').urlsToImgSet
  },
  get useHotKey() {
    if (!moduleCache.has('./hot-key')) {
      moduleCache.set('./hot-key', require('./hot-key'))
    }
    return moduleCache.get('./hot-key').useHotKey
  },
  get useInterval() {
    if (!moduleCache.has('./use-timers')) {
      moduleCache.set('./use-timers', require('./use-timers'))
    }
    return moduleCache.get('./use-timers').useInterval
  },
  get useModalHeaderTitleAndCancel() {
    if (!moduleCache.has('./modal')) {
      moduleCache.set('./modal', require('./modal'))
    }
    return moduleCache.get('./modal').useModalHeaderTitleAndCancel
  },
  get usePopup2() {
    if (!moduleCache.has('./use-popup')) {
      moduleCache.set('./use-popup', require('./use-popup'))
    }
    return moduleCache.get('./use-popup').usePopup2
  },
  get useSafeAreaInsets() {
    if (!moduleCache.has('./safe-area-view')) {
      moduleCache.set('./safe-area-view', require('./safe-area-view'))
    }
    return moduleCache.get('./safe-area-view').useSafeAreaInsets
  },
  get useTimeout() {
    if (!moduleCache.has('./use-timers')) {
      moduleCache.set('./use-timers', require('./use-timers'))
    }
    return moduleCache.get('./use-timers').useTimeout
  },
}
