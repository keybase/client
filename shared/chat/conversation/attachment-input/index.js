// @flow
import * as React from 'react'
import {Box, Button, Icon, Image, Input, PopupDialog, Text, ButtonBar} from '../../../common-adapters/index'
import {globalColors, globalStyles, isMobile} from '../../../styles'
import {isIPhoneX} from '../../../constants/platform'

export type PathToInfo = {
  [path: string]: {
    type: 'image' | 'file',
    title: string,
    filename: string,
  },
}

type Props = {
  pathToInfo: PathToInfo,
  onClose: () => void,
  onSubmit: (pathToInfo: PathToInfo) => void,
}
type State = {
  index: number,
  pathToInfo: PathToInfo,
}

class RenderAttachmentInput extends React.Component<Props, State> {
  state: State
  _input: ?Input

  constructor(props: Props) {
    super(props)
    this.state = {
      index: 0,
      pathToInfo: props.pathToInfo,
    }
  }

  _onNext = () => {
    const paths = Object.keys(this.state.pathToInfo)
    const path = paths[this.state.index]
    const info = this.state.pathToInfo[path]
    if (!info) return

    const nextIndex = this.state.index + 1

    // done
    if (nextIndex === paths.length) {
      this.props.onSubmit(this.state.pathToInfo)
    } else {
      // go to next
      this.setState({index: nextIndex})
    }
  }

  _updateTitle = (title: string) => {
    this.setState(state => {
      const paths = Object.keys(this.state.pathToInfo)
      const path = paths[this.state.index]

      return {
        pathToInfo: {
          ...state.pathToInfo,
          [path]: {
            ...state.pathToInfo[path],
            title,
          },
        },
      }
    })
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState.index !== this.state.index) {
      this._input && this._input.select()
    }
  }

  componentDidMount() {
    this._input && this._input.select()
  }

  _setRef = input => (this._input = input)

  render() {
    const paths = Object.keys(this.state.pathToInfo)
    const path = paths[this.state.index]
    const info = this.state.pathToInfo[path]
    if (!info) return null

    return (
      <PopupDialog onClose={this.props.onClose} styleContainer={isIPhoneX ? {marginTop: 30} : undefined}>
        <Box style={isMobile ? stylesMobile : stylesDesktop}>
          <Box style={{...globalStyles.flexBoxCenter, height: 150, width: 150}}>
            {info.type === 'image' ? (
              <Image src={path} style={{maxHeight: '100%', maxWidth: '100%'}} />
            ) : (
              <Icon type="icon-file-uploading-48" />
            )}
          </Box>
          {paths.length > 0 && (
            <Text type="BodySmall" style={{color: globalColors.black_40, marginTop: 5}}>
              {info.filename} ({this.state.index + 1} of {paths.length})
            </Text>
          )}
          <Input
            style={isMobile ? stylesInputMobile : stylesInputDesktop}
            autoFocus={true}
            floatingHintTextOverride="Title"
            value={info.title}
            onEnterKeyDown={this._onNext}
            ref={this._setRef}
            onChangeText={this._updateTitle}
          />
          <ButtonBar style={{flexShrink: 0}}>
            <Button type="Secondary" onClick={this.props.onClose} label="Cancel" />
            <Button type="Primary" onClick={this._onNext} label="Send" />
          </ButtonBar>
        </Box>
      </PopupDialog>
    )
  }
}

const stylesDesktop = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginBottom: 80,
  marginLeft: 80,
  marginRight: 80,
  marginTop: 90,
}

const stylesInputDesktop = {
  flexShrink: 0,
  marginTop: 70,
  width: 460,
}

const stylesMobile = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'flex-start',
  marginTop: 40,
}

const stylesInputMobile = {
  marginTop: 40,
  minWidth: 320,
  paddingLeft: 20,
  paddingRight: 20,
}

export default RenderAttachmentInput
