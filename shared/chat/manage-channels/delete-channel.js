// @flow
import * as React from 'react'
import {Text, Box, Icon, PopupMenu} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'

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
}

type State = {}

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

class DeleteChannel extends React.Component<Props, State> {
  // The DOM manipulations below implicitly assume that we're on
  // desktop. We'll probably have to handle mobile differently,
  // anyway.

  _hidePopup = () => {
    if (!isMobile) {
      const ReactDOM = require('react-dom')
      ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
    }
  }

  _onClick(event: SyntheticEvent<>) {
    const target = (event.target: any)
    const clientRect = target.getBoundingClientRect()

    // Position next to button (client rect)
    // TODO: Measure instead of pixel math
    const x = clientRect.left - 32
    let y = clientRect.top - 176
    if (y < 10) y = 10
    const style = {left: x, position: 'absolute', top: y}

    const header = {
      title: 'header',
      view: <PopupHeader channelName={this.props.channelName} />,
    }

    const items = [
      'Divider',
      {danger: true, onClick: this.props.onConfirmedDelete, title: 'Yes, delete channel'},
      {title: 'Cancel'},
    ]
    const popupComponent = (
      <PopupMenu
        header={header}
        items={items}
        onHidden={() => this._hidePopup()}
        style={{...stylePopup, ...style}}
      />
    )
    const container = document.getElementById('popupContainer')
    if (!isMobile) {
      const ReactDOM = require('react-dom')
      // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
      ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
    }
  }

  render() {
    const {disabled} = this.props
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          position: 'absolute',
          left: 0,
          opacity: disabled ? 0.5 : undefined,
        }}
      >
        <Icon
          type="iconfont-trash"
          style={{height: 14, color: globalColors.red, marginRight: globalMargins.tiny}}
        />
        <Text
          type={disabled ? 'Body' : 'BodyPrimaryLink'}
          style={{color: globalColors.red}}
          onClick={disabled ? undefined : e => this._onClick(e)}
        >
          Delete Channel
        </Text>
      </Box>
    )
  }
}

export default DeleteChannel
