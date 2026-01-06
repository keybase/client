import * as React from 'react'

import * as Styles from '@/styles'
export {isValidIconType} from './icon.shared'
export {urlsToImgSet} from './icon'
export {largeHeight as largeListItem2Height, smallHeight as smallListItem2Height} from './list-item2'
export {useHotKey} from './hot-key'
export {useInterval, useTimeout} from './use-timers'
export {useModalHeaderTitleAndCancel} from './modal'
export {usePopup2} from './use-popup'
export {useSafeAreaInsets} from './safe-area-view'

export const Animation = React.lazy(async () => import('./animation').then(m => ({default: m.default})))
export const Avatar = React.lazy(async () => import('./avatar').then(m => ({default: m.default})))
export const AvatarLine = React.lazy(async () =>
  import('./avatar/avatar-line').then(m => ({default: m.default}))
)
export const BackButton = React.lazy(async () => import('./back-button').then(m => ({default: m.default})))
export const Badge = React.lazy(async () => import('./badge').then(m => ({default: m.default})))
export const Banner = React.lazy(async () => import('./banner').then(m => ({default: m.Banner})))
export const BannerParagraph = React.lazy(async () =>
  import('./banner').then(m => ({default: m.BannerParagraph}))
)
export const BottomSheetBackdrop = React.lazy(async () =>
  import('./bottom-sheet').then(m => ({default: m.BottomSheetBackdrop}))
)
export const BottomSheetModal = React.lazy(async () =>
  import('./bottom-sheet').then(m => ({default: m.BottomSheetModal}))
)
export const BottomSheetScrollView = React.lazy(async () =>
  import('./bottom-sheet').then(m => ({default: m.BottomSheetScrollView}))
)
export {default as Box, Box2, Box2Animated, Box2Div, Box2Measure, Box2View} from './box'
export {default as BoxGrow, BoxGrow2} from './box-grow'
export {default as Button} from './button'
export const ButtonBar = React.lazy(async () => import('./button-bar').then(m => ({default: m.default})))
export const CheckCircle = React.lazy(async () => import('./check-circle').then(m => ({default: m.default})))
export const Checkbox = React.lazy(async () => import('./checkbox').then(m => ({default: m.default})))
export const ChoiceList = React.lazy(async () => import('./choice-list').then(m => ({default: m.default})))
export {default as ClickableBox, ClickableBox2} from './clickable-box'
export const ConfirmModal = React.lazy(async () =>
  import('./confirm-modal').then(m => ({default: m.default}))
)
export {default as ConnectedNameWithIcon} from './name-with-icon'
export {default as ConnectedUsernames} from './usernames'
export const CopyText = React.lazy(async () => import('./copy-text').then(m => ({default: m.default})))
export const CopyableText = React.lazy(async () =>
  import('./copyable-text').then(m => ({default: m.default}))
)
export const DelayedMounting = React.lazy(async () =>
  import('./delayed-mounting').then(m => ({default: m.default}))
)
export const Divider = React.lazy(async () => import('./divider').then(m => ({default: m.default})))
export const DragAndDrop = React.lazy(async () => import('./drag-and-drop').then(m => ({default: m.default})))
export const Dropdown = React.lazy(async () => import('./dropdown').then(m => ({default: m.default})))
export const DropdownButton = React.lazy(async () =>
  import('./dropdown').then(m => ({default: m.DropdownButton}))
)
export const Emoji = React.lazy(async () => import('./emoji').then(m => ({default: m.default})))
export const ErrorBoundary = React.lazy(async () =>
  import('./error-boundary').then(m => ({default: m.default}))
)
export const FloatingBox = React.lazy(async () => import('./floating-box').then(m => ({default: m.default})))
export const FloatingMenu = React.lazy(async () =>
  import('./floating-menu').then(m => ({default: m.default}))
)
export const FloatingModalContext = React.lazy(async () =>
  import('./floating-menu/context').then(m => ({default: m.FloatingModalContext}))
)
export const FloatingPicker = React.lazy(async () =>
  import('./floating-picker').then(m => ({default: m.default}))
)
export {HeaderHocHeader, HeaderHocWrapper, HeaderLeftBlank, HeaderLeftCancel} from './header-hoc'
export const HotKey = React.lazy(async () => import('./hot-key').then(m => ({default: m.HotKey})))
export {default as Icon} from './icon'
export const Image2 = React.lazy(async () => import('./image2').then(m => ({default: m.default})))
export const InfoNote = React.lazy(async () => import('./info-note').then(m => ({default: m.default})))
export const InlineDropdown = React.lazy(async () =>
  import('./dropdown').then(m => ({default: m.InlineDropdown}))
)
export const Input2 = React.lazy(async () => import('./input2').then(m => ({default: m.Input2})))
export {KeyboardAvoidingView2} from './keyboard-avoiding-view'
export const LabeledInput = React.lazy(async () =>
  import('./labeled-input').then(m => ({default: m.default}))
)
export const List = React.lazy(async () => import('./list').then(m => ({default: m.default})))
export const List2 = React.lazy(async () => import('./list2').then(m => ({default: m.default})))
export const ListItem = React.lazy(async () => import('./list-item').then(m => ({default: m.default})))
export const ListItem2 = React.lazy(async () => import('./list-item2').then(m => ({default: m.default})))
export const LoadingLine = React.lazy(async () => import('./loading-line').then(m => ({default: m.default})))
export const Markdown = React.lazy(async () => import('./markdown').then(m => ({default: m.default})))
export const Meta = React.lazy(async () => import('./meta').then(m => ({default: m.default})))
export const MobilePopup = React.lazy(async () => import('./mobile-popup').then(m => ({default: m.default})))
export const Modal = React.lazy(async () => import('./modal').then(m => ({default: m.default})))
export const Modal2 = React.lazy(async () => import('./modal2').then(m => ({default: m.default})))
export const ModalHeader = React.lazy(async () => import('./modal').then(m => ({default: m.Header})))
export const NameWithIcon = React.lazy(async () =>
  import('./name-with-icon').then(m => ({default: m.default}))
)
export const NativeEmoji = React.lazy(async () =>
  import('./emoji/native-emoji').then(m => ({default: m.default}))
)
export const NewInput = React.lazy(async () => import('./new-input').then(m => ({default: m.default})))
export const Overlay = React.lazy(async () => import('./overlay').then(m => ({default: m.default})))
export const PhoneInput = React.lazy(async () => import('./phone-input').then(m => ({default: m.default})))
export const Placeholder = React.lazy(async () => import('./placeholder').then(m => ({default: m.default})))
export const PlainInput = React.lazy(async () => import('./plain-input').then(m => ({default: m.default})))
export const PlatformIcon = React.lazy(async () =>
  import('./platform-icon').then(m => ({default: m.default}))
)
export const PopupDialog = React.lazy(async () => import('./popup-dialog').then(m => ({default: m.default})))
export const PopupHeaderText = React.lazy(async () =>
  import('./popup-header-text').then(m => ({default: m.default}))
)
export const PopupWrapper = React.lazy(async () =>
  import('./header-or-popup').then(m => ({default: m.PopupWrapper}))
)
export {default as ProfileCard} from './profile-card'
export const ProgressBar = React.lazy(async () => import('./progress-bar').then(m => ({default: m.default})))
export const ProgressIndicator = React.lazy(async () =>
  import('./progress-indicator').then(m => ({default: m.default}))
)
export const ProofBrokenBanner = React.lazy(async () =>
  import('./proof-broken-banner').then(m => ({default: m.default}))
)
export const RadioButton = React.lazy(async () => import('./radio-button').then(m => ({default: m.default})))
export {default as Reloadable} from './reload'
export const RichButton = React.lazy(async () => import('./rich-button').then(m => ({default: m.default})))
export const RoundedBox = React.lazy(async () => import('./rounded-box').then(m => ({default: m.default})))
export {default as SafeAreaView, SafeAreaViewTop} from './safe-area-view'
export const SaveIndicator = React.lazy(async () =>
  import('./save-indicator').then(m => ({default: m.default}))
)
export {default as ScrollView} from './scroll-view'
export const SearchFilter = React.lazy(async () =>
  import('./search-filter').then(m => ({default: m.default}))
)
export const SectionDivider = React.lazy(async () =>
  import('./section-divider').then(m => ({default: m.default}))
)
export const SectionList = React.lazy(async () => import('./section-list').then(m => ({default: m.default})))
export const SimpleToast = React.lazy(async () => import('./simple-toast').then(m => ({default: m.default})))
export const Switch = React.lazy(async () => import('./switch').then(m => ({default: m.default})))
export const Tabs = React.lazy(async () => import('./tabs').then(m => ({default: m.default})))
export const TeamWithPopup = React.lazy(async () =>
  import('./team-with-popup').then(m => ({default: m.default}))
)
export {default as Text} from './text'
export {Text2} from './text2'
export const TimelineMarker = React.lazy(async () =>
  import('./timeline-marker').then(m => ({default: m.default}))
)
export const Toast = React.lazy(async () => import('./toast').then(m => ({default: m.default})))
export const Video = React.lazy(async () => import('./video').then(m => ({default: m.default})))
export const WaitingButton = React.lazy(async () =>
  import('./waiting-button').then(m => ({default: m.default}))
)
export const WaveButton = React.lazy(async () => import('./wave-button').then(m => ({default: m.default})))
export const WebView = React.lazy(async () => import('./web-view').then(m => ({default: m.default})))
export const WithTooltip = React.lazy(async () => import('./with-tooltip').then(m => ({default: m.default})))
export const ZoomableImage = React.lazy(async () =>
  import('./zoomable-image').then(m => ({default: m.default}))
)

export {Styles}
