import * as React from 'react'

import * as Styles from '@/styles'
import {isValidIconType} from './icon.shared'
import {urlsToImgSet} from './icon'
import {largeHeight, smallHeight} from './list-item2'
import {useHotKey} from './hot-key'
import {useInterval, useTimeout} from './use-timers'
import {useModalHeaderTitleAndCancel} from './modal'
import {usePopup2} from './use-popup'
import {useSafeAreaInsets} from './safe-area-view'

export const Animation = React.lazy(() => import('./animation').then(m => ({default: m.default})))
export const Avatar = React.lazy(() => import('./avatar').then(m => ({default: m.default})))
export const AvatarLine = React.lazy(() => import('./avatar/avatar-line').then(m => ({default: m.default})))
export const BackButton = React.lazy(() => import('./back-button').then(m => ({default: m.default})))
export const Badge = React.lazy(() => import('./badge').then(m => ({default: m.default})))
export const Banner = React.lazy(() => import('./banner').then(m => ({default: m.Banner})))
export const BannerParagraph = React.lazy(() => import('./banner').then(m => ({default: m.BannerParagraph})))
export const BottomSheetBackdrop = React.lazy(() => import('./bottom-sheet').then(m => ({default: m.BottomSheetBackdrop})))
export const BottomSheetModal = React.lazy(() => import('./bottom-sheet').then(m => ({default: m.BottomSheetModal})))
export const BottomSheetScrollView = React.lazy(() => import('./bottom-sheet').then(m => ({default: m.BottomSheetScrollView})))
export const Box = React.lazy(() => import('./box').then(m => ({default: m.default})))
export const Box2 = React.lazy(() => import('./box').then(m => ({default: m.Box2})))
export const Box2Animated = React.lazy(() => import('./box').then(m => ({default: m.Box2Animated})))
export const Box2Div = React.lazy(() => import('./box').then(m => ({default: m.Box2Div})))
export const Box2Measure = React.lazy(() => import('./box').then(m => ({default: m.Box2Measure})))
export const Box2View = React.lazy(() => import('./box').then(m => ({default: m.Box2View})))
export const BoxGrow = React.lazy(() => import('./box-grow').then(m => ({default: m.default})))
export const BoxGrow2 = React.lazy(() => import('./box-grow').then(m => ({default: m.BoxGrow2})))
export const Button = React.lazy(() => import('./button').then(m => ({default: m.default})))
export const ButtonBar = React.lazy(() => import('./button-bar').then(m => ({default: m.default})))
export const CheckCircle = React.lazy(() => import('./check-circle').then(m => ({default: m.default})))
export const Checkbox = React.lazy(() => import('./checkbox').then(m => ({default: m.default})))
export const ChoiceList = React.lazy(() => import('./choice-list').then(m => ({default: m.default})))
export const ClickableBox = React.lazy(() => import('./clickable-box').then(m => ({default: m.default})))
export const ClickableBox2 = React.lazy(() => import('./clickable-box').then(m => ({default: m.ClickableBox2})))
export const ConfirmModal = React.lazy(() => import('./confirm-modal').then(m => ({default: m.default})))
export const ConnectedNameWithIcon = React.lazy(() =>
  import('./name-with-icon').then(async m => {
    await import('./profile-card')
    return {default: m.default}
  })
)
export const ConnectedUsernames = React.lazy(() =>
  import('./usernames').then(async m => {
    await import('./profile-card')
    return {default: m.default}
  })
)
export const CopyText = React.lazy(() => import('./copy-text').then(m => ({default: m.default})))
export const CopyableText = React.lazy(() => import('./copyable-text').then(m => ({default: m.default})))
export const DelayedMounting = React.lazy(() => import('./delayed-mounting').then(m => ({default: m.default})))
export const Divider = React.lazy(() => import('./divider').then(m => ({default: m.default})))
export const DragAndDrop = React.lazy(() => import('./drag-and-drop').then(m => ({default: m.default})))
export const Dropdown = React.lazy(() => import('./dropdown').then(m => ({default: m.default})))
export const DropdownButton = React.lazy(() => import('./dropdown').then(m => ({default: m.DropdownButton})))
export const Emoji = React.lazy(() => import('./emoji').then(m => ({default: m.default})))
export const ErrorBoundary = React.lazy(() => import('./error-boundary').then(m => ({default: m.default})))
export const FloatingBox = React.lazy(() => import('./floating-box').then(m => ({default: m.default})))
export const FloatingMenu = React.lazy(() => import('./floating-menu').then(m => ({default: m.default})))
export const FloatingModalContext = React.lazy(() => import('./floating-menu/context').then(m => ({default: m.FloatingModalContext})))
export const FloatingPicker = React.lazy(() => import('./floating-picker').then(m => ({default: m.default})))
export const HeaderHocHeader = React.lazy(() => import('./header-hoc').then(m => ({default: m.HeaderHocHeader})))
export const HeaderHocWrapper = React.lazy(() => import('./header-hoc').then(m => ({default: m.HeaderHocWrapper})))
export const HeaderLeftBlank = React.lazy(() => import('./header-hoc').then(m => ({default: m.HeaderLeftBlank})))
export const HeaderLeftCancel = React.lazy(() => import('./header-hoc').then(m => ({default: m.HeaderLeftCancel})))
export const HotKey = React.lazy(() => import('./hot-key').then(m => ({default: m.HotKey})))
export const Icon = React.lazy(() => import('./icon').then(m => ({default: m.default})))
export const Image2 = React.lazy(() => import('./image2').then(m => ({default: m.default})))
export const InfoNote = React.lazy(() => import('./info-note').then(m => ({default: m.default})))
export const InlineDropdown = React.lazy(() => import('./dropdown').then(m => ({default: m.InlineDropdown})))
export const Input2 = React.lazy(() => import('./input2').then(m => ({default: m.Input2})))
export const KeyboardAvoidingView2 = React.lazy(() => import('./keyboard-avoiding-view').then(m => ({default: m.KeyboardAvoidingView2})))
export const LabeledInput = React.lazy(() => import('./labeled-input').then(m => ({default: m.default})))
export const List = React.lazy(() => import('./list').then(m => ({default: m.default})))
export const List2 = React.lazy(() => import('./list2').then(m => ({default: m.default})))
export const ListItem = React.lazy(() => import('./list-item').then(m => ({default: m.default})))
export const ListItem2 = React.lazy(() => import('./list-item2').then(m => ({default: m.default})))
export const LoadingLine = React.lazy(() => import('./loading-line').then(m => ({default: m.default})))
export const Markdown = React.lazy(() => import('./markdown').then(m => ({default: m.default})))
export const Meta = React.lazy(() => import('./meta').then(m => ({default: m.default})))
export const MobilePopup = React.lazy(() => import('./mobile-popup').then(m => ({default: m.default})))
export const Modal = React.lazy(() => import('./modal').then(m => ({default: m.default})))
export const Modal2 = React.lazy(() => import('./modal2').then(m => ({default: m.default})))
export const ModalHeader = React.lazy(() => import('./modal').then(m => ({default: m.Header})))
export const NameWithIcon = React.lazy(() => import('./name-with-icon').then(m => ({default: m.default})))
export const NativeEmoji = React.lazy(() => import('./emoji/native-emoji').then(m => ({default: m.default})))
export const NewInput = React.lazy(() => import('./new-input').then(m => ({default: m.default})))
export const Overlay = React.lazy(() => import('./overlay').then(m => ({default: m.default})))
export const PhoneInput = React.lazy(() => import('./phone-input').then(m => ({default: m.default})))
export const Placeholder = React.lazy(() => import('./placeholder').then(m => ({default: m.default})))
export const PlainInput = React.lazy(() => import('./plain-input').then(m => ({default: m.default})))
export const PlatformIcon = React.lazy(() => import('./platform-icon').then(m => ({default: m.default})))
export const PopupDialog = React.lazy(() => import('./popup-dialog').then(m => ({default: m.default})))
export const PopupHeaderText = React.lazy(() => import('./popup-header-text').then(m => ({default: m.default})))
export const PopupWrapper = React.lazy(() => import('./header-or-popup').then(m => ({default: m.PopupWrapper})))
export const ProfileCard = React.lazy(() => import('./profile-card').then(m => ({default: m.default})))
export const ProgressBar = React.lazy(() => import('./progress-bar').then(m => ({default: m.default})))
export const ProgressIndicator = React.lazy(() => import('./progress-indicator').then(m => ({default: m.default})))
export const ProofBrokenBanner = React.lazy(() => import('./proof-broken-banner').then(m => ({default: m.default})))
export const RadioButton = React.lazy(() => import('./radio-button').then(m => ({default: m.default})))
export const Reloadable = React.lazy(() => import('./reload').then(m => ({default: m.default})))
export const RichButton = React.lazy(() => import('./rich-button').then(m => ({default: m.default})))
export const RoundedBox = React.lazy(() => import('./rounded-box').then(m => ({default: m.default})))
export const SafeAreaView = React.lazy(() => import('./safe-area-view').then(m => ({default: m.default})))
export const SafeAreaViewTop = React.lazy(() => import('./safe-area-view').then(m => ({default: m.SafeAreaViewTop})))
export const SaveIndicator = React.lazy(() => import('./save-indicator').then(m => ({default: m.default})))
export const ScrollView = React.lazy(() => import('./scroll-view').then(m => ({default: m.default})))
export const SearchFilter = React.lazy(() => import('./search-filter').then(m => ({default: m.default})))
export const SectionDivider = React.lazy(() => import('./section-divider').then(m => ({default: m.default})))
export const SectionList = React.lazy(() => import('./section-list').then(m => ({default: m.default})))
export const SimpleToast = React.lazy(() => import('./simple-toast').then(m => ({default: m.default})))
export const Switch = React.lazy(() => import('./switch').then(m => ({default: m.default})))
export const Tabs = React.lazy(() => import('./tabs').then(m => ({default: m.default})))
export const TeamWithPopup = React.lazy(() => import('./team-with-popup').then(m => ({default: m.default})))
export const Text = React.lazy(() => import('./text').then(m => ({default: m.default})))
export const Text2 = React.lazy(() => import('./text2').then(m => ({default: m.Text2})))
export const TimelineMarker = React.lazy(() => import('./timeline-marker').then(m => ({default: m.default})))
export const Toast = React.lazy(() => import('./toast').then(m => ({default: m.default})))
export const Video = React.lazy(() => import('./video').then(m => ({default: m.default})))
export const WaitingButton = React.lazy(() => import('./waiting-button').then(m => ({default: m.default})))
export const WaveButton = React.lazy(() => import('./wave-button').then(m => ({default: m.default})))
export const WebView = React.lazy(() => import('./web-view').then(m => ({default: m.default})))
export const WithTooltip = React.lazy(() => import('./with-tooltip').then(m => ({default: m.default})))
export const ZoomableImage = React.lazy(() => import('./zoomable-image').then(m => ({default: m.default})))

export {Styles}
export {isValidIconType}
export {urlsToImgSet}
export {largeHeight as largeListItem2Height, smallHeight as smallListItem2Height}
export {useHotKey}
export {useInterval, useTimeout}
export {useModalHeaderTitleAndCancel}
export {usePopup2}
export {useSafeAreaInsets}

