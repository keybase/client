// @flow
import * as React from 'react'
import {Text, Box, Icon, FloatingMenu} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {
  type FloatingMenuParentProps,
  FloatingMenuParentHOC,
} from '../../common-adapters/floating-menu/parent-hoc'

const PopupHeader = ({channelName}: {channelName: string}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingLeft: globalMargins.tiny,
        paddingRight: globalMargins.tiny,
        paddingTop: globalMargins.small,
        width: '100%',
      }}
    >
      <Text type="BodySemibold" style={{color: globalColors.black, textAlign: 'center'}}>
        Are you sure you want to delete #{channelName}?
      </Text>
      <Text type="BodySmall" style={{color: globalColors.black_40, textAlign: 'center'}}>
        All messages will be lost. This cannot be undone.
      </Text>
    </Box>
  )
}

type Props = {
  channelName: string,
  disabled: boolean,
  onConfirmedDelete: () => void,
} & FloatingMenuParentProps

type State = {}

class _DeleteChannel extends React.Component<Props, State> {
  render() {
    const {disabled} = this.props

    const boxStyle = platformStyles({
      common: {
        ...globalStyles.flexBoxRow,
        opacity: disabled ? 0.5 : undefined,
      },
      isElectron: {
        position: 'absolute',
        left: 0,
      },
      isMobile: {
        paddingLeft: globalMargins.large,
        paddingRight: globalMargins.large,
        paddingTop: globalMargins.medium,
        paddingBottom: globalMargins.medium,
      },
    })

    const header = {
      title: 'header',
      view: <PopupHeader channelName={this.props.channelName} />,
    }

    const items = [
      'Divider',
      {danger: true, onClick: this.props.onConfirmedDelete, title: 'Yes, delete channel'},
      {onClick: this.props.toggleShowingMenu, title: 'Cancel'},
    ]

    return (
      <Box style={boxStyle}>
        <Icon
          type="iconfont-trash"
          style={{height: 14, marginRight: globalMargins.tiny}}
          color={globalColors.red}
        />
        <FloatingMenu
          header={header}
          items={items}
          attachTo={this.props.attachmentRef}
          visible={this.props.showingMenu}
          onHidden={this.props.toggleShowingMenu}
        />
        <Text
          type={disabled ? 'Body' : 'BodyPrimaryLink'}
          style={{color: globalColors.red}}
          onClick={this.props.toggleShowingMenu}
          ref={this.props.setAttachmentRef}
        >
          Delete Channel
        </Text>
      </Box>
    )
  }
}

const DeleteChannel = FloatingMenuParentHOC(_DeleteChannel)
export default DeleteChannel
