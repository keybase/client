// Deferred loading with type safety - type assertions inside each getter
import {LayoutAnimation} from 'react-native'

/* eslint-disable @typescript-eslint/no-unsafe-member-access*/
const components = {
  get Animation() {
    return require('./animation').default as typeof import('./animation').default
  },
  get Avatar() {
    return require('./avatar').default as typeof import('./avatar').default
  },
  get AvatarLine() {
    return require('./avatar/avatar-line').default as typeof import('./avatar/avatar-line').default
  },
  get BackButton() {
    return require('./back-button').default as typeof import('./back-button').default
  },
  get Badge() {
    return require('./badge').default as typeof import('./badge').default
  },
  get Banner() {
    return require('./banner').Banner as (typeof import('./banner'))['Banner']
  },
  get BannerParagraph() {
    return require('./banner').BannerParagraph as (typeof import('./banner'))['BannerParagraph']
  },
  get BottomSheetBackdrop() {
    return require('./bottom-sheet')
      .BottomSheetBackdrop as (typeof import('./bottom-sheet'))['BottomSheetBackdrop']
  },
  get BottomSheetModal() {
    return require('./bottom-sheet').BottomSheetModal as (typeof import('./bottom-sheet'))['BottomSheetModal']
  },
  get BottomSheetScrollView() {
    return require('./bottom-sheet')
      .BottomSheetScrollView as (typeof import('./bottom-sheet'))['BottomSheetScrollView']
  },
  get Box() {
    return require('./box').default as typeof import('./box').default
  },
  get Box2() {
    return require('./box').Box2 as (typeof import('./box'))['Box2']
  },
  get Box2Animated() {
    return require('./box').Box2Animated as (typeof import('./box'))['Box2Animated']
  },
  get Box2Div() {
    return require('./box').Box2Div as (typeof import('./box'))['Box2Div']
  },
  get Box2Measure() {
    return require('./box').Box2Measure as (typeof import('./box'))['Box2Measure']
  },
  get Box2View() {
    return require('./box').Box2View as (typeof import('./box'))['Box2View']
  },
  get BoxGrow() {
    return require('./box-grow').default as typeof import('./box-grow').default
  },
  get BoxGrow2() {
    return require('./box-grow').BoxGrow2 as (typeof import('./box-grow'))['BoxGrow2']
  },
  get Button() {
    return require('./button').default as typeof import('./button').default
  },
  get ButtonBar() {
    return require('./button-bar').default as typeof import('./button-bar').default
  },
  get CheckCircle() {
    return require('./check-circle').default as typeof import('./check-circle').default
  },
  get Checkbox() {
    return require('./checkbox').default as typeof import('./checkbox').default
  },
  get ChoiceList() {
    return require('./choice-list').default as typeof import('./choice-list').default
  },
  get ClickableBox() {
    return require('./clickable-box').default as typeof import('./clickable-box').default
  },
  get ClickableBox2() {
    return require('./clickable-box').ClickableBox2 as (typeof import('./clickable-box'))['ClickableBox2']
  },
  get ConfirmModal() {
    return require('./confirm-modal').default as typeof import('./confirm-modal').default
  },
  get ConnectedNameWithIcon() {
    require('./profile-card').default
    return require('./name-with-icon').default as typeof import('./name-with-icon').default
  },
  get ConnectedUsernames() {
    require('./profile-card').default
    return require('./usernames').default as typeof import('./usernames').default
  },
  get CopyText() {
    return require('./copy-text').default as typeof import('./copy-text').default
  },
  get CopyableText() {
    return require('./copyable-text').default as typeof import('./copyable-text').default
  },
  get DelayedMounting() {
    return require('./delayed-mounting').default as typeof import('./delayed-mounting').default
  },
  get Divider() {
    return require('./divider').default as typeof import('./divider').default
  },
  get DragAndDrop() {
    return require('./drag-and-drop').default as typeof import('./drag-and-drop').default
  },
  get Dropdown() {
    return require('./dropdown').default as typeof import('./dropdown').default
  },
  get DropdownButton() {
    return require('./dropdown').DropdownButton as (typeof import('./dropdown'))['DropdownButton']
  },
  get Emoji() {
    return require('./emoji').default as typeof import('./emoji').default
  },
  get ErrorBoundary() {
    return require('./error-boundary').default as typeof import('./error-boundary').default
  },
  get FloatingBox() {
    return require('./floating-box').default as typeof import('./floating-box').default
  },
  get FloatingMenu() {
    return require('./floating-menu').default as typeof import('./floating-menu').default
  },
  get FloatingModalContext() {
    return require('./floating-menu/context')
      .FloatingModalContext as (typeof import('./floating-menu/context'))['FloatingModalContext']
  },
  get FloatingPicker() {
    return require('./floating-picker').default as typeof import('./floating-picker').default
  },
  get HeaderHocHeader() {
    return require('./header-hoc').HeaderHocHeader as (typeof import('./header-hoc'))['HeaderHocHeader']
  },
  get HeaderHocWrapper() {
    return require('./header-hoc').HeaderHocWrapper as (typeof import('./header-hoc'))['HeaderHocWrapper']
  },
  get HeaderLeftBlank() {
    return require('./header-hoc').HeaderLeftBlank as (typeof import('./header-hoc'))['HeaderLeftBlank']
  },
  get HeaderLeftCancel() {
    return require('./header-hoc').HeaderLeftCancel as (typeof import('./header-hoc'))['HeaderLeftCancel']
  },
  get HotKey() {
    return require('./hot-key').HotKey as (typeof import('./hot-key'))['HotKey']
  },
  get Icon() {
    return require('./icon').default as typeof import('./icon').default
  },
  get Image2() {
    return require('./image2').default as typeof import('./image2').default
  },
  get InfoNote() {
    return require('./info-note').default as typeof import('./info-note').default
  },
  get InlineDropdown() {
    return require('./dropdown').InlineDropdown as (typeof import('./dropdown'))['InlineDropdown']
  },
  get Input2() {
    return require('./input2').Input2 as (typeof import('./input2'))['Input2']
  },
  get KeyboardAvoidingView2() {
    return require('./keyboard-avoiding-view')
      .KeyboardAvoidingView2 as (typeof import('./keyboard-avoiding-view'))['KeyboardAvoidingView2']
  },
  get LabeledInput() {
    return require('./labeled-input').default as typeof import('./labeled-input').default
  },
  get List() {
    return require('./list').default as typeof import('./list').default
  },
  get List2() {
    return require('./list2').default as typeof import('./list2').default
  },
  get ListItem() {
    return require('./list-item').default as typeof import('./list-item').default
  },
  get ListItem2() {
    return require('./list-item2').default as typeof import('./list-item2').default
  },
  get LoadingLine() {
    return require('./loading-line').default as typeof import('./loading-line').default
  },
  get Markdown() {
    return require('./markdown').default as typeof import('./markdown').default
  },
  get Meta() {
    return require('./meta').default as typeof import('./meta').default
  },
  get MobilePopup() {
    return require('./mobile-popup').default as typeof import('./mobile-popup').default
  },
  get Modal() {
    return require('./modal').default as typeof import('./modal').default
  },
  get Modal2() {
    return require('./modal2').default as typeof import('./modal2').default
  },
  get ModalHeader() {
    return require('./modal').Header as (typeof import('./modal'))['Header']
  },
  get NameWithIcon() {
    return require('./name-with-icon').default as typeof import('./name-with-icon').default
  },
  get NativeEmoji() {
    return require('./emoji/native-emoji').default as typeof import('./emoji/native-emoji').default
  },
  get NewInput() {
    return require('./new-input').default as typeof import('./new-input').default
  },
  get Overlay() {
    return require('./overlay').default as typeof import('./overlay').default
  },
  get PhoneInput() {
    return require('./phone-input').default as typeof import('./phone-input').default
  },
  get Placeholder() {
    return require('./placeholder').default as typeof import('./placeholder').default
  },
  get PlainInput() {
    return require('./plain-input').default as typeof import('./plain-input').default
  },
  get PlatformIcon() {
    return require('./platform-icon').default as typeof import('./platform-icon').default
  },
  get PopupDialog() {
    return require('./popup-dialog').default as typeof import('./popup-dialog').default
  },
  get PopupHeaderText() {
    return require('./popup-header-text').default as typeof import('./popup-header-text').default
  },
  get PopupWrapper() {
    return require('./header-or-popup').PopupWrapper as (typeof import('./header-or-popup'))['PopupWrapper']
  },
  get ProfileCard() {
    return require('./profile-card').default as typeof import('./profile-card').default
  },
  get ProgressBar() {
    return require('./progress-bar').default as typeof import('./progress-bar').default
  },
  get ProgressIndicator() {
    return require('./progress-indicator').default as typeof import('./progress-indicator').default
  },
  get ProofBrokenBanner() {
    return require('./proof-broken-banner').default as typeof import('./proof-broken-banner').default
  },
  get RadioButton() {
    return require('./radio-button').default as typeof import('./radio-button').default
  },
  get Reloadable() {
    return require('./reload').default as typeof import('./reload').default
  },
  get RichButton() {
    return require('./rich-button').default as typeof import('./rich-button').default
  },
  get RoundedBox() {
    return require('./rounded-box').default as typeof import('./rounded-box').default
  },
  get SafeAreaView() {
    return require('./safe-area-view').default as typeof import('./safe-area-view').default
  },
  get SafeAreaViewTop() {
    return require('./safe-area-view')
      .SafeAreaViewTop as (typeof import('./safe-area-view'))['SafeAreaViewTop']
  },
  get SaveIndicator() {
    return require('./save-indicator').default as typeof import('./save-indicator').default
  },
  get ScrollView() {
    return require('./scroll-view').default as typeof import('./scroll-view').default
  },
  get SearchFilter() {
    return require('./search-filter').default as typeof import('./search-filter').default
  },
  get SectionDivider() {
    return require('./section-divider').default as typeof import('./section-divider').default
  },
  get SectionList() {
    return require('./section-list').default as typeof import('./section-list').default
  },
  get SimpleToast() {
    return require('./simple-toast').default as typeof import('./simple-toast').default
  },
  get Styles() {
    return require('../styles') as typeof import('../styles')
  },
  get Switch() {
    return require('./switch').default as typeof import('./switch').default
  },
  get Tabs() {
    return require('./tabs').default as typeof import('./tabs').default
  },
  get TeamWithPopup() {
    return require('./team-with-popup').default as typeof import('./team-with-popup').default
  },
  get Text() {
    return require('./text').default as typeof import('./text').default
  },
  get Text2() {
    return require('./text2').Text2 as (typeof import('./text2'))['Text2']
  },
  get TimelineMarker() {
    return require('./timeline-marker').default as typeof import('./timeline-marker').default
  },
  get Toast() {
    return require('./toast').default as typeof import('./toast').default
  },
  get Video() {
    return require('./video').default as typeof import('./video').default
  },
  get WaitingButton() {
    return require('./waiting-button').default as typeof import('./waiting-button').default
  },
  get WaveButton() {
    return require('./wave-button').default as typeof import('./wave-button').default
  },
  get WebView() {
    return require('./web-view').default as typeof import('./web-view').default
  },
  get WithTooltip() {
    return require('./with-tooltip').default as typeof import('./with-tooltip').default
  },
  get ZoomableImage() {
    return require('./zoomable-image').default as typeof import('./zoomable-image').default
  },
  get isValidIconType() {
    return require('./icon.shared').isValidIconType as (typeof import('./icon.shared'))['isValidIconType']
  },
  get largeListItem2Height() {
    return require('./list-item2').largeHeight as (typeof import('./list-item2'))['largeHeight']
  },
  get smallListItem2Height() {
    return require('./list-item2').smallHeight as (typeof import('./list-item2'))['smallHeight']
  },
  get urlsToImgSet() {
    return require('./icon').urlsToImgSet as (typeof import('./icon'))['urlsToImgSet']
  },
  get useHotKey() {
    return require('./hot-key').useHotKey as (typeof import('./hot-key'))['useHotKey']
  },
  get useInterval() {
    return require('./use-timers').useInterval as (typeof import('./use-timers'))['useInterval']
  },
  get useModalHeaderTitleAndCancel() {
    return require('./modal')
      .useModalHeaderTitleAndCancel as (typeof import('./modal'))['useModalHeaderTitleAndCancel']
  },
  get usePopup2() {
    return require('./use-popup').usePopup2 as (typeof import('./use-popup'))['usePopup2']
  },
  get useSafeAreaInsets() {
    return require('./safe-area-view')
      .useSafeAreaInsets as (typeof import('./safe-area-view'))['useSafeAreaInsets']
  },
  get useTimeout() {
    return require('./use-timers').useTimeout as (typeof import('./use-timers'))['useTimeout']
  },
}

export const {
  Animation,
  Avatar,
  AvatarLine,
  BackButton,
  Badge,
  Banner,
  BannerParagraph,
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  Box,
  Box2,
  Box2Animated,
  Box2Div,
  Box2Measure,
  Box2View,
  BoxGrow,
  BoxGrow2,
  Button,
  ButtonBar,
  CheckCircle,
  Checkbox,
  ChoiceList,
  ClickableBox,
  ClickableBox2,
  ConfirmModal,
  ConnectedNameWithIcon,
  ConnectedUsernames,
  CopyText,
  CopyableText,
  DelayedMounting,
  Divider,
  DragAndDrop,
  Dropdown,
  DropdownButton,
  Emoji,
  ErrorBoundary,
  FloatingBox,
  FloatingMenu,
  FloatingModalContext,
  FloatingPicker,
  HeaderHocHeader,
  HeaderHocWrapper,
  HeaderLeftBlank,
  HeaderLeftCancel,
  HotKey,
  Icon,
  Image2,
  InfoNote,
  InlineDropdown,
  Input2,
  KeyboardAvoidingView2,
  LabeledInput,
  List,
  List2,
  ListItem,
  ListItem2,
  LoadingLine,
  Markdown,
  Meta,
  MobilePopup,
  Modal,
  Modal2,
  ModalHeader,
  NameWithIcon,
  NativeEmoji,
  NewInput,
  Overlay,
  PhoneInput,
  Placeholder,
  PlainInput,
  PlatformIcon,
  PopupDialog,
  PopupHeaderText,
  PopupWrapper,
  ProfileCard,
  ProgressBar,
  ProgressIndicator,
  ProofBrokenBanner,
  RadioButton,
  Reloadable,
  RichButton,
  RoundedBox,
  SafeAreaView,
  SafeAreaViewTop,
  SaveIndicator,
  ScrollView,
  SearchFilter,
  SectionDivider,
  SectionList,
  SimpleToast,
  Styles,
  Switch,
  Tabs,
  TeamWithPopup,
  Text,
  Text2,
  TimelineMarker,
  Toast,
  Video,
  WaitingButton,
  WaveButton,
  WebView,
  WithTooltip,
  ZoomableImage,
  isValidIconType,
  largeListItem2Height,
  smallListItem2Height,
  urlsToImgSet,
  useHotKey,
  useInterval,
  useModalHeaderTitleAndCancel,
  usePopup2,
  useSafeAreaInsets,
  useTimeout,
} = components

export {LayoutAnimation}

export type {MenuItem, MenuItems} from './floating-menu/menu-layout'
export type {IconType} from './icon.constants-gen'
export type {WebViewProps, WebViewInjections} from './web-view'
export type {AnimationType} from './animation'
export type {BottomSheetBackdropProps} from './bottom-sheet'
export type {LayoutEvent} from './box'
export type {MeasureDesktop, MeasureNative, MeasureRef} from './measure-ref'
export type {Popup2Parms} from './use-popup'
export type {IconStyle} from './icon'
export type {PlainInputRef} from './plain-input'
export type {SearchFilterRef} from './search-filter'
export type {ScrollViewRef} from './scroll-view'
export type {SectionListRef, SectionType} from './section-list'
