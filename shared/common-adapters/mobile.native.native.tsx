// @ts-nocheck
module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in common-adapters/mobile.native')
  })

const Index = require('.')
const NativeWrappers = require('./native-wrappers.native')

module.exports = {
  get Animated() {
    return Index.Animated
  },
  get Animation() {
    return Index.Animation
  },
  get Avatar() {
    return Index.Avatar
  },
  get AvatarLine() {
    return Index.AvatarLine
  },
  get BackButton() {
    return Index.BackButton
  },
  get BackgroundRepeatBox() {
    return Index.BackgroundRepeatBox
  },
  get Badge() {
    return Index.Badge
  },
  get Banner() {
    return Index.Banner
  },
  get BannerParagraph() {
    return Index.BannerParagraph
  },
  get Box() {
    return Index.Box
  },
  get Box2() {
    return Index.Box2
  },
  get BoxGrow() {
    return Index.BoxGrow
  },
  get Button() {
    return Index.Button
  },
  get ButtonBar() {
    return Index.ButtonBar
  },
  get CheckCircle() {
    return Index.CheckCircle
  },
  get Checkbox() {
    return Index.Checkbox
  },
  get ChoiceList() {
    return Index.ChoiceList
  },
  get ClickableBox() {
    return Index.ClickableBox
  },
  get ConfirmModal() {
    return Index.ConfirmModal
  },
  get ConnectedNameWithIcon() {
    return Index.ConnectedNameWithIcon
  },
  get ConnectedUsernames() {
    return Index.ConnectedUsernames
  },
  get CopyText() {
    return Index.CopyText
  },
  get CopyableText() {
    return Index.CopyableText
  },
  get CustomEmoji() {
    return Index.CustomEmoji
  },
  get DesktopStyle() {
    return Index.DesktopStyle
  },
  get Divider() {
    return Index.Divider
  },
  get DragAndDrop() {
    return Index.DragAndDrop
  },
  get Dropdown() {
    return Index.Dropdown
  },
  get DropdownButton() {
    return Index.DropdownButton
  },
  get Emoji() {
    return Index.Emoji
  },
  get EmojiIfExists() {
    return Index.EmojiIfExists
  },
  get ErrorBoundary() {
    return Index.ErrorBoundary
  },
  get FloatingBox() {
    return Index.FloatingBox
  },
  get FloatingMenu() {
    return Index.FloatingMenu
  },
  get FloatingPicker() {
    return Index.FloatingPicker
  },
  get GestureState() {
    return require('react-native-gesture-handler').State
  },
  get Header() {
    return Index.Header
  },
  get HeaderHoc() {
    return Index.HeaderHoc
  },
  get HeaderHocHeader() {
    return Index.HeaderHocHeader
  },
  get HeaderOrPopup() {
    return Index.HeaderOrPopup
  },
  get HeaderOrPopupWithHeader() {
    return Index.HeaderOrPopupWithHeader
  },
  get HoverHoc() {
    return Index.HoverHoc
  },
  get Icon() {
    return Index.Icon
  },
  get Image() {
    return Index.Image
  },
  get InfoNote() {
    return Index.InfoNote
  },
  get Input() {
    return Index.Input
  },
  get KeyboardAvoidingView() {
    return Index.KeyboardAvoidingView
  },
  get LabeledInput() {
    return Index.LabeledInput
  },
  get LayoutAnimation() {
    return require('react-native').LayoutAnimation
  },
  get List() {
    return Index.List
  },
  get List2() {
    return Index.List2
  },
  get ListItem() {
    return Index.ListItem
  },
  get ListItem2() {
    return Index.ListItem2
  },
  get LoadingLine() {
    return Index.LoadingLine
  },
  get LongPressGestureHandler() {
    return require('react-native-gesture-handler').LongPressGestureHandler
  },
  get Markdown() {
    return Index.Markdown
  },
  get MaybePopup() {
    return Index.MaybePopup
  },
  get Meta() {
    return Index.Meta
  },
  get Modal() {
    return Index.Modal
  },
  get ModalHeader() {
    return Index.ModalHeader
  },
  get MultiAvatar() {
    return Index.MultiAvatar
  },
  get NameWithIcon() {
    return Index.NameWithIcon
  },
  get NativeActivityIndicator() {
    return NativeWrappers.NativeActivityIndicator
  },
  get NativeAlert() {
    return NativeWrappers.NativeAlert
  },
  get NativeAnimated() {
    return NativeWrappers.NativeAnimated
  },
  get NativeBackHandler() {
    return NativeWrappers.NativeBackHandler
  },
  get NativeClipboard() {
    return NativeWrappers.NativeClipboard
  },
  get NativeDimensions() {
    return NativeWrappers.NativeDimensions
  },
  get NativeDrawerLayoutAndroid() {
    return NativeWrappers.NativeDrawerLayoutAndroid
  },
  get NativeEasing() {
    return NativeWrappers.NativeEasing
  },
  get NativeFastImage() {
    return NativeWrappers.NativeFastImage
  },
  get NativeFlatList() {
    return NativeWrappers.NativeFlatList
  },
  get NativeImage() {
    return NativeWrappers.NativeImage
  },
  get NativeInteractionManager() {
    return NativeWrappers.NativeInteractionManager
  },
  get NativeKeyboard() {
    return NativeWrappers.NativeKeyboard
  },
  get NativeKeyboardAvoidingView() {
    return NativeWrappers.NativeKeyboardAvoidingView
  },
  get NativeLinking() {
    return NativeWrappers.NativeLinking
  },
  get NativeModal() {
    return NativeWrappers.NativeModal
  },
  get NativePanResponder() {
    return NativeWrappers.NativePanResponder
  },
  get NativePicker() {
    return NativeWrappers.NativePicker
  },
  get NativeRefreshControl() {
    return NativeWrappers.NativeRefreshControl
  },
  get NativeSafeAreaView() {
    return NativeWrappers.NativeSafeAreaView
  },
  get NativeScrollView() {
    return NativeWrappers.NativeScrollView
  },
  get NativeSectionList() {
    return NativeWrappers.NativeSectionList
  },
  get NativeStatusBar() {
    return NativeWrappers.NativeStatusBar
  },
  get NativeStyleSheet() {
    return NativeWrappers.NativeStyleSheet
  },
  get NativeSwitch() {
    return NativeWrappers.NativeSwitch
  },
  get NativeText() {
    return NativeWrappers.NativeText
  },
  get NativeTextInput() {
    return NativeWrappers.NativeTextInput
  },
  get NativeTouchableHighlight() {
    return NativeWrappers.NativeTouchableHighlight
  },
  get NativeTouchableNativeFeedback() {
    return NativeWrappers.NativeTouchableNativeFeedback
  },
  get NativeTouchableOpacity() {
    return NativeWrappers.NativeTouchableOpacity
  },
  get NativeTouchableWithoutFeedback() {
    return NativeWrappers.NativeTouchableWithoutFeedback
  },
  get NativeView() {
    return NativeWrappers.NativeView
  },
  get NativeVirtualizedList() {
    return NativeWrappers.NativeVirtualizedList
  },
  get NativeWebView() {
    return NativeWrappers.NativeWebView
  },
  get NewInput() {
    return Index.NewInput
  },
  get Overlay() {
    return Index.Overlay
  },
  get OverlayParentHOC() {
    return Index.OverlayParentHOC
  },
  get PanGestureHandler() {
    return require('react-native-gesture-handler').PanGestureHandler
  },
  get Placeholder() {
    return Index.Placeholder
  },
  get PlainInput() {
    return Index.PlainInput
  },
  get PlaintextUsernames() {
    return Index.PlaintextUsernames
  },
  get PlatformIcon() {
    return Index.PlatformIcon
  },
  get PopupDialog() {
    return Index.PopupDialog
  },
  get PopupDialogHoc() {
    return Index.PopupDialogHoc
  },
  get PopupHeaderText() {
    return Index.PopupHeaderText
  },
  get ProgressBar() {
    return Index.ProgressBar
  },
  get ProgressIndicator() {
    return Index.ProgressIndicator
  },
  get ProofBrokenBanner() {
    return Index.ProofBrokenBanner
  },
  get QRScanner() {
    return require('./qr-scanner.native').default
  },
  get RadioButton() {
    return Index.RadioButton
  },
  get ReAnimated() {
    return require('./reanimated').default
  },
  get ReAnimatedEasing() {
    return require('./reanimated').EasingNode
  },
  get RectButton() {
    return require('react-native-gesture-handler').RectButton
  },
  get Reloadable() {
    return Index.Reloadable
  },
  get RequireImage() {
    return Index.RequireImage
  },
  get RoundedBox() {
    return Index.RoundedBox
  },
  get SafeAreaView() {
    return Index.SafeAreaView
  },
  get SafeAreaViewTop() {
    return Index.SafeAreaViewTop
  },
  get SaveIndicator() {
    return Index.SaveIndicator
  },
  get ScrollView() {
    return Index.ScrollView
  },
  get SearchFilter() {
    return Index.SearchFilter
  },
  get SectionDivider() {
    return Index.SectionDivider
  },
  get SectionList() {
    return Index.SectionList
  },
  get SimpleToast() {
    return Index.SimpleToast
  },
  get StandardScreen() {
    return Index.StandardScreen
  },
  get Swipeable() {
    return require('react-native-gesture-handler/Swipeable').default
  },
  get Switch() {
    return Index.Switch
  },
  get Tabs() {
    return Index.Tabs
  },
  get TapGestureHandler() {
    return require('react-native-gesture-handler').TapGestureHandler
  },
  get Text() {
    return Index.Text
  },
  get TimelineMarker() {
    return Index.TimelineMarker
  },
  get Toast() {
    return Index.Toast
  },
  get Usernames() {
    return Index.Usernames
  },
  get Video() {
    return Index.Video
  },
  get WaitingButton() {
    return Index.WaitingButton
  },
  get WebView() {
    return Index.WebView
  },
  get WithTooltip() {
    return Index.WithTooltip
  },
  get ZoomableBox() {
    return require('./zoomable-box').ZoomableBox
  },
  get ZoomableImage() {
    return require('./zoomable-image.native').default
  },
  get isValidIconType() {
    return Index.isValidIconType
  },
  get largeListItem2Height() {
    return Index.largeListItem2Height
  },
  get smallListItem2Height() {
    return Index.smallListItem2Height
  },
  get urlsToImgSet() {
    return Index.urlsToImgSet
  },
  get useInterval() {
    return Index.useInterval
  },
  get useMounted() {
    return Index.useMounted
  },
  get useSafeAreaInsets() {
    return Index.useSafeAreaInsets
  },
  get useTimeout() {
    return Index.useTimeout
  },
}
