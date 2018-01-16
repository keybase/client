// @noflow
// import * as React from 'react'
// import {Box, Checkbox, Icon, RadioButton, ProgressIndicator, Text} from '../../../../common-adapters'
// import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'
// import {type NotificationSaveState} from '../../../../constants/types/chat'
// import type {Props} from '.'

// const SaveStateComponents = (saveState: NotificationSaveState) => {
// switch (saveState) {
// case 'unsaved':
// return null
// case 'saving':
// return <ProgressIndicator style={{alignSelf: 'center', width: globalMargins.medium}} />
// case 'saved':
// return [
// <Icon key="0" type="iconfont-check" style={{color: globalColors.green}} />,
// <Text key="1" type="BodySmall" style={{color: globalColors.green}}>
// &nbsp; Saved
// </Text>,
// ]
// }
// }

// const Notifications = ({
// channelWide,
// desktop,
// mobile,
// saveState,
// onSetDesktop,
// onSetMobile,
// onToggleChannelWide,
// }: Props) => (
// <Box
// style={{
// ...globalStyles.flexBoxColumn,
// paddingLeft: globalMargins.small,
// paddingRight: globalMargins.small,
// }}
// >
// <Checkbox
// checked={!channelWide}
// label="Ignore @here and @channel mentions"
// onCheck={onToggleChannelWide}
// />

// <Box style={isMobile ? styleHeaderMobile : styleHeader}>
// <Text type="BodySmallSemibold">Desktop notifications</Text>
// <Icon
// style={{fontSize: isMobile ? 20 : 16, paddingLeft: globalMargins.xtiny, color: globalColors.black_20}}
// type="iconfont-notifications-desktop"
// />
// </Box>

// <Box style={styleRadioButton}>
// <RadioButton
// style={{marginTop: globalMargins.xtiny}}
// onSelect={() => onSetDesktop('generic')}
// selected={desktop === 'generic'}
// label={'On any activity'}
// />
// </Box>
// <Box style={styleRadioButton}>
// <RadioButton
// style={{marginTop: globalMargins.xtiny}}
// onSelect={() => onSetDesktop('atmention')}
// selected={desktop === 'atmention'}
// label={'Only when @mentioned'}
// />
// </Box>
// <Box style={styleRadioButton}>
// <RadioButton
// style={{marginTop: globalMargins.xtiny}}
// onSelect={() => onSetDesktop('never')}
// selected={desktop === 'never'}
// label={'Never'}
// />
// </Box>

// <Box style={styleHeader}>
// <Text type="BodySmallSemibold">Mobile notifications</Text>
// <Icon
// style={{fontSize: isMobile ? 20 : 16, paddingLeft: globalMargins.xtiny, color: globalColors.black_20}}
// type="iconfont-notifications-mobile"
// />
// </Box>

// <Box style={styleRadioButton}>
// <RadioButton
// style={{marginTop: globalMargins.xtiny}}
// onSelect={() => onSetMobile('generic')}
// selected={mobile === 'generic'}
// label={'On any activity'}
// />
// </Box>
// <Box style={styleRadioButton}>
// <RadioButton
// style={{marginTop: globalMargins.xtiny}}
// onSelect={() => onSetMobile('atmention')}
// selected={mobile === 'atmention'}
// label={'Only when @mentioned'}
// />
// </Box>
// <Box style={styleRadioButton}>
// <RadioButton
// style={{marginTop: globalMargins.xtiny}}
// onSelect={() => onSetMobile('never')}
// selected={mobile === 'never'}
// label={'Never'}
// />
// </Box>
// <Box style={styleSaveState}>{SaveStateComponents(saveState)}</Box>
// </Box>
// )

// const styleHeader = {
// ...globalStyles.flexBoxRow,
// paddingTop: globalMargins.small,
// }

// const styleHeaderMobile = {
// ...styleHeader,
// paddingTop: globalMargins.medium,
// paddingBottom: globalMargins.tiny,
// }

// const styleRadioButton = {
// ...globalStyles.flexBoxRow,
// marginLeft: globalMargins.tiny,
// }

// const styleSaveState = {
// ...globalStyles.flexBoxRow,
// height: globalMargins.large,
// justifyContent: 'center',
// paddingTop: globalMargins.small,
// }

// export default Notifications
