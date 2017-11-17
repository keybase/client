// @flow
import * as React from 'react'
import ReactDOM from 'react-dom'
import {Text, Box, Icon, PopupMenu} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

type Props = {
  disabled: boolean,
  onConfirmedDelete: () => void,
}

type State = {}

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

class DeleteChannel extends React.Component<Props, State> {
  _hidePopup = () => {
    ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
  }

  _onClick(event: SyntheticEvent<>) {
    const target = (event.target: any)
    const clientRect = target.getBoundingClientRect()

    // Position next to button (client rect)
    // TODO: Measure instead of pixel math
    const x = clientRect.left - 45
    let y = clientRect.top - 116
    if (y < 10) y = 10
    const style = {left: x, position: 'absolute', top: y}

    const items = []
    items.push({title: 'Foo'})
    const popupComponent = (
      <PopupMenu items={items} onHidden={() => this._hidePopup()} style={{...stylePopup, ...style}} />
    )
    const container = document.getElementById('popupContainer')
    // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
    ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
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
