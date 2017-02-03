// @flow
import React, {Component} from 'react'
import {Input, PopupDialog, Box, Button} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

type Props = {
  onClose: () => void,
  onSubmit: (message: string) => void,
  message: string,
  rect: {
    top: number,
    left: number,
    width: number,
    height: number,
  },
}

class EditPopup extends Component<void, Props, void> {
  _input: any

  _setRef = (r: any) => {
    this._input = r
  }

  _onSave = () => {
    this._input && this.props.onSubmit(this._input.getValue())
    this.props.onClose()
  }

  render () {
    const {onClose, message, onSubmit, rect} = this.props
    // The setImmediate is due to some timing issues when injecting the portal using the unsafe method, TODO clean that up soon

    return <PopupDialog
      allowClipBubbling={true}
      fill={false}
      onClose={onClose}
      styleClipContainer={{backgroundColor: globalColors.transparent}}
      styleClose={{display: 'none'}}
      styleContainer={{height: '100%', width: '100%'}}
      styleCover={{backgroundColor: globalColors.transparent, padding: 0}}>
      <Box style={{
        ...globalStyles.flexBoxColumn,
        backgroundColor: globalColors.white,
        borderBottom: `1px solid ${globalColors.black_05}`,
        borderTop: `1px solid ${globalColors.black_05}`,
        left: rect.left,
        paddingBottom: globalMargins.xtiny,
        position: 'absolute',
        top: rect.top,
      }}>
        <Input
          ref={this._setRef}
          autoFocus={true}
          small={true}
          hideUnderline={true}
          value={message}
          multiline={true}
          rowsMin={1}
          rowsMax={5}
          onEnterKeyDown={(e) => {
            e.preventDefault()
            onSubmit(e.target.textContent)
            onClose()
          }}
          style={{
            height: rect.height,
            maxWidth: rect.width,
            textAlign: 'left',
            width: rect.width,
          }} />
        <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
          <Button type='Secondary' label='Cancel' onClick={() => { setImmediate(onClose) }} />
          <Button type='Primary' label='Save' onClick={() => { setImmediate(this._onSave) }} />
        </Box>
      </Box>
    </PopupDialog>
  }
}

export default EditPopup
