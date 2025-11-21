// Deferred loading with type safety - TypeScript will error if types don't match
export = {
  get Animation() {
    return require('./animation').default
  },
  get Avatar() {
    return require('./avatar').default
  },
  get AvatarLine() {
    return require('./avatar/avatar-line').default
  },
  get BackButton() {
    return require('./back-button').default
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
  get BottomSheetBackdrop() {
    return require('./bottom-sheet').BottomSheetBackdrop
  },
  get BottomSheetModal() {
    return require('./bottom-sheet').BottomSheetModal
  },
  get BottomSheetScrollView() {
    return require('./bottom-sheet').BottomSheetScrollView
  },
  get Box() {
    return require('./box').default
  },
  get Box2() {
    return require('./box').Box2
  },
  get Box2Animated() {
    return require('./box').Box2Animated
  },
  get Box2Div() {
    return require('./box').Box2Div
  },
  get Box2Measure() {
    return require('./box').Box2Measure
  },
  get Box2View() {
    return require('./box').Box2View
  },
  get BoxGrow() {
    return require('./box-grow').default
  },
  get BoxGrow2() {
    return require('./box-grow').BoxGrow2
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
  get ClickableBox2() {
    return require('./clickable-box').ClickableBox2
  },
  get ConfirmModal() {
    return require('./confirm-modal').default
  },
  get ConnectedNameWithIcon() {
    require('./profile-card').default
    return require('./name-with-icon').default
  },
  get ConnectedUsernames() {
    require('./profile-card').default
    return require('./usernames').default
  },
  get CopyText() {
    return require('./copy-text').default
  },
  get CopyableText() {
    return require('./copyable-text').default
  },
  get DelayedMounting() {
    return require('./delayed-mounting').default
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
  get ErrorBoundary() {
    return require('./error-boundary').default
  },
  get FloatingBox() {
    return require('./floating-box').default
  },
  get FloatingMenu() {
    return require('./floating-menu').default
  },
  get FloatingModalContext() {
    return require('./floating-menu/context').FloatingModalContext
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
  get Icon() {
    return require('./icon').default
  },
  get Image2() {
    return require('./image2').default
  },
  get InfoNote() {
    return require('./info-note').default
  },
  get InlineDropdown() {
    return require('./dropdown').InlineDropdown
  },
  get Input2() {
    return require('./input2').Input2
  },
  get KeyboardAvoidingView2() {
    return require('./keyboard-avoiding-view').KeyboardAvoidingView2
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
  get NameWithIcon() {
    return require('./name-with-icon').default
  },
  get NativeEmoji() {
    return require('./emoji/native-emoji').default
  },
  get NewInput() {
    return require('./new-input').default
  },
  get Overlay() {
    return require('./overlay').default
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
  get Styles() {
    return require('@/styles')
  },
  get Switch() {
    return require('./switch').default
  },
  get Tabs() {
    return require('./tabs').default
  },
  get TeamWithPopup() {
    return require('./team-with-popup').default
  },
  get Text() {
    return require('./text').default
  },
  get Text2() {
    return require('./text2').Text2
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
  get ZoomableImage() {
    return require('./zoomable-image').default
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
    return require('./modal').useModalHeaderTitleAndCancel
  },
  get usePopup2() {
    return require('./use-popup').usePopup2
  },
  get useSafeAreaInsets() {
    return require('./safe-area-view').useSafeAreaInsets
  },
  get useTimeout() {
    return require('./use-timers').useTimeout
  },
} satisfies {
  Animation: typeof import('./animation').default
  Avatar: typeof import('./avatar').default
  AvatarLine: typeof import('./avatar/avatar-line').default
  BackButton: typeof import('./back-button').default
  Badge: typeof import('./badge').default
  Banner: typeof import('./banner')['Banner']
  BannerParagraph: typeof import('./banner')['BannerParagraph']
  BottomSheetBackdrop: typeof import('./bottom-sheet')['BottomSheetBackdrop']
  BottomSheetModal: typeof import('./bottom-sheet')['BottomSheetModal']
  BottomSheetScrollView: typeof import('./bottom-sheet')['BottomSheetScrollView']
  Box: typeof import('./box').default
  Box2: typeof import('./box')['Box2']
  Box2Animated: typeof import('./box')['Box2Animated']
  Box2Div: typeof import('./box')['Box2Div']
  Box2Measure: typeof import('./box')['Box2Measure']
  Box2View: typeof import('./box')['Box2View']
  BoxGrow: typeof import('./box-grow').default
  BoxGrow2: typeof import('./box-grow')['BoxGrow2']
  Button: typeof import('./button').default
  ButtonBar: typeof import('./button-bar').default
  CheckCircle: typeof import('./check-circle').default
  Checkbox: typeof import('./checkbox').default
  ChoiceList: typeof import('./choice-list').default
  ClickableBox: typeof import('./clickable-box').default
  ClickableBox2: typeof import('./clickable-box')['ClickableBox2']
  ConfirmModal: typeof import('./confirm-modal').default
  ConnectedNameWithIcon: typeof import('./name-with-icon').default
  ConnectedUsernames: typeof import('./usernames').default
  CopyText: typeof import('./copy-text').default
  CopyableText: typeof import('./copyable-text').default
  DelayedMounting: typeof import('./delayed-mounting').default
  Divider: typeof import('./divider').default
  DragAndDrop: typeof import('./drag-and-drop').default
  Dropdown: typeof import('./dropdown').default
  DropdownButton: typeof import('./dropdown')['DropdownButton']
  Emoji: typeof import('./emoji').default
  ErrorBoundary: typeof import('./error-boundary').default
  FloatingBox: typeof import('./floating-box').default
  FloatingMenu: typeof import('./floating-menu').default
  FloatingModalContext: typeof import('./floating-menu/context')['FloatingModalContext']
  FloatingPicker: typeof import('./floating-picker').default
  HeaderHocHeader: typeof import('./header-hoc')['HeaderHocHeader']
  HeaderHocWrapper: typeof import('./header-hoc')['HeaderHocWrapper']
  HeaderLeftBlank: typeof import('./header-hoc')['HeaderLeftBlank']
  HeaderLeftCancel: typeof import('./header-hoc')['HeaderLeftCancel']
  HotKey: typeof import('./hot-key')['HotKey']
  Icon: typeof import('./icon').default
  Image2: typeof import('./image2').default
  InfoNote: typeof import('./info-note').default
  InlineDropdown: typeof import('./dropdown')['InlineDropdown']
  Input2: typeof import('./input2')['Input2']
  KeyboardAvoidingView2: typeof import('./keyboard-avoiding-view')['KeyboardAvoidingView2']
  LabeledInput: typeof import('./labeled-input').default
  List: typeof import('./list').default
  List2: typeof import('./list2').default
  ListItem: typeof import('./list-item').default
  ListItem2: typeof import('./list-item2').default
  LoadingLine: typeof import('./loading-line').default
  Markdown: typeof import('./markdown').default
  Meta: typeof import('./meta').default
  MobilePopup: typeof import('./mobile-popup').default
  Modal: typeof import('./modal').default
  Modal2: typeof import('./modal2').default
  ModalHeader: typeof import('./modal')['Header']
  NameWithIcon: typeof import('./name-with-icon').default
  NewInput: typeof import('./new-input').default
  Overlay: typeof import('./overlay').default
  PhoneInput: typeof import('./phone-input').default
  Placeholder: typeof import('./placeholder').default
  PlainInput: typeof import('./plain-input').default
  PlatformIcon: typeof import('./platform-icon').default
  PopupDialog: typeof import('./popup-dialog').default
  PopupHeaderText: typeof import('./popup-header-text').default
  PopupWrapper: typeof import('./header-or-popup')['PopupWrapper']
  ProfileCard: typeof import('./profile-card').default
  ProgressBar: typeof import('./progress-bar').default
  ProgressIndicator: typeof import('./progress-indicator').default
  ProofBrokenBanner: typeof import('./proof-broken-banner').default
  RadioButton: typeof import('./radio-button').default
  Reloadable: typeof import('./reload').default
  RichButton: typeof import('./rich-button').default
  RoundedBox: typeof import('./rounded-box').default
  SafeAreaView: typeof import('./safe-area-view').default
  SafeAreaViewTop: typeof import('./safe-area-view')['SafeAreaViewTop']
  SaveIndicator: typeof import('./save-indicator').default
  ScrollView: typeof import('./scroll-view').default
  SearchFilter: typeof import('./search-filter').default
  SectionDivider: typeof import('./section-divider').default
  SectionList: typeof import('./section-list').default
  SimpleToast: typeof import('./simple-toast').default
  Styles: typeof import('@/styles')
  Switch: typeof import('./switch').default
  Tabs: typeof import('./tabs').default
  TeamWithPopup: typeof import('./team-with-popup').default
  Text: typeof import('./text').default
  Text2: typeof import('./text2')['Text2']
  TimelineMarker: typeof import('./timeline-marker').default
  Toast: typeof import('./toast').default
  Video: typeof import('./video').default
  WaitingButton: typeof import('./waiting-button').default
  WaveButton: typeof import('./wave-button').default
  WebView: typeof import('./web-view').default
  WithTooltip: typeof import('./with-tooltip').default
  ZoomableImage: typeof import('./zoomable-image').default
  isValidIconType: typeof import('./icon.shared')['isValidIconType']
  largeListItem2Height: typeof import('./list-item2')['largeHeight']
  smallListItem2Height: typeof import('./list-item2')['smallHeight']
  urlsToImgSet: typeof import('./icon')['urlsToImgSet']
  useHotKey: typeof import('./hot-key')['useHotKey']
  useInterval: typeof import('./use-timers')['useInterval']
  useModalHeaderTitleAndCancel: typeof import('./modal')['useModalHeaderTitleAndCancel']
  usePopup2: typeof import('./use-popup')['usePopup2']
  useSafeAreaInsets: typeof import('./safe-area-view')['useSafeAreaInsets']
  useTimeout: typeof import('./use-timers')['useTimeout']
}

