// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins} from '../../styles'
import rowStyles from './styles'
import {Input, Box, Button, Text, Divider} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'

type EditingProps = {
  name: string,
  status: Types.PathItemEditingStatusType,
  itemStyles: Types.ItemStyles,
  isCreate: boolean,
  onSubmit: (name: string) => void,
  onCancel: () => void,
}

type State = {
  name: string,
}

class Editing extends React.PureComponent<EditingProps, State> {
  constructor(props: EditingProps) {
    super(props)
    this.state = {
      name: props.name,
    }
  }

  _onSubmit = () => this.props.onSubmit(this.state.name)

  _input: any

  _setInputRef = r => {
    this._input = r
  }

  _focusInput = () => {
    if (!this._input) {
      return
    }
    this._input.select()
    this._input.focus()
  }

  componentDidMount() {
    this._focusInput()
  }

  render() {
    return (
      <Box>
        <Box style={rowStyles.row}>
          <PathItemIcon spec={this.props.itemStyles.iconSpec} style={rowStyles.pathItemIcon} />
          <Box key="main" style={rowStyles.itemBox}>
            <Input
              ref={this._setInputRef}
              hideUnderline={true}
              small={true}
              value={this.state.name}
              hintText={this.props.name}
              inputStyle={stylesText}
              onEnterKeyDown={this._onSubmit}
              onChangeText={name => this.setState({name})}
            />
          </Box>
          <Box key="right" style={rowStyles.rightBox}>
            {this.props.status === 'failed' && <Text type="BodyError">Failed</Text>}
            <Button
              key="create"
              style={stylesButton}
              type="Primary"
              small={true}
              label={this.props.status === 'failed' ? 'Retry' : this.props.isCreate ? 'Create' : 'Save'}
              waiting={this.props.status === 'saving'}
              onClick={this.props.status === 'saving' ? undefined : this._onSubmit}
            />
            <Button
              key="cancel"
              style={stylesButton}
              type="Secondary"
              small={true}
              label="Cancel"
              onClick={this.props.onCancel}
            />
          </Box>
        </Box>
        <Divider style={rowStyles.divider} />
      </Box>
    )
  }
}

const stylesText = {
  ...globalStyles.fontSemibold,
  maxWidth: '100%',
}

const stylesButton = {
  marginLeft: globalMargins.tiny,
  width: 80,
}

export default Editing
