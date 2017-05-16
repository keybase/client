// @flow
import React, {Component} from 'react'
import {Input, PopupDialog, Box, Button} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

type Props = {
  onClose: () => void,
  onSubmit: (message: string) => void,
  message: string,
  messageRect: {
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

  render() {
    const {onClose, message, onSubmit, messageRect} = this.props
    // The setImmediate is due to some timing issues when injecting the portal using the unsafe method, TODO clean that up soon

    return (
      <PopupDialog
        allowClipBubbling={true}
        fill={false}
        onClose={onClose}
        styleClipContainer={{backgroundColor: globalColors.transparent}}
        styleClose={{display: 'none'}}
        styleContainer={{height: '100%', width: '100%'}}
        styleCover={{backgroundColor: globalColors.transparent, padding: 0}}
      >
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            backgroundColor: globalColors.white,
            borderBottom: `1px solid ${globalColors.black_05}`,
            borderTop: `1px solid ${globalColors.black_05}`,
            left: messageRect.left,
            paddingBottom: globalMargins.xtiny,
            position: 'absolute',
            top: messageRect.top,
          }}
        >
          <Input
            ref={this._setRef}
            autoFocus={true}
            small={true}
            hideUnderline={true}
            value={message}
            multiline={true}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation() // else the bottom input bar gets focus!
            }}
            rowsMin={1}
            rowsMax={5}
            onEnterKeyDown={e => {
              e.preventDefault()
              onSubmit(e.target.textContent)
              onClose()
            }}
            style={{
              height: messageRect.height,
              maxWidth: messageRect.width,
              textAlign: 'left',
              width: messageRect.width,
            }}
          />
          <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
            <Button
              type="Secondary"
              label="Cancel"
              onClick={e => {
                e.preventDefault()
                setImmediate(onClose)
              }}
            />
            <Button
              type="Primary"
              label="Save"
              onClick={e => {
                e.preventDefault()
                const value = this._input && this._input.getValue()
                setImmediate(() => {
                  this.props.onSubmit(value)
                  this.props.onClose()
                })
              }}
            />
          </Box>
        </Box>
      </PopupDialog>
    )
  }
}

export default EditPopup
