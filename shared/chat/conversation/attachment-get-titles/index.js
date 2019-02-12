// @flow
import * as React from 'react'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../common-adapters/index'
import * as Styles from '../../../styles'

export type PathToInfo = {
  [path: string]: {
    type: 'image' | 'file',
    title: string,
    filename: string,
    outboxID: RPCChatTypes.OutboxID,
  },
}

type Props = {
  pathToInfo: PathToInfo,
  onCancel: () => void,
  onSubmit: (pathToInfo: PathToInfo) => void,
}
type State = {
  index: number,
  pathToInfo: PathToInfo,
}

class GetTitles extends React.Component<Props, State> {
  state: State
  _input: ?Kb.Input

  constructor(props: Props) {
    super(props)
    this.state = {
      index: 0,
      pathToInfo: props.pathToInfo,
    }
  }

  _onNext = (e: SyntheticEvent<>) => {
    e.preventDefault()

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

  _isLast = () => {
    const numPaths = Object.keys(this.state.pathToInfo).length
    return this.state.index + 1 === numPaths
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
    const titleHint = 'Caption (optional)'
    if (!info) return null

    return (
      <Kb.ScrollView style={{height: '100%', width: '100%'}}>
        <Kb.Box style={Styles.isMobile ? stylesMobile : stylesDesktop}>
          <Kb.Box style={{...Styles.globalStyles.flexBoxCenter, height: 150, width: 150}}>
            {info.type === 'image' ? (
              <Kb.OrientedImage
                src={Styles.isAndroid ? `file://${path}` : path}
                style={Styles.isMobile ? {height: 150, width: 150} : {maxHeight: '100%', maxWidth: '100%'}}
              />
            ) : (
              <Kb.Icon type="icon-file-uploading-48" />
            )}
          </Kb.Box>
          {paths.length > 0 && (
            <Kb.Box2
              direction="vertical"
              style={{
                alignItems: 'center',
                marginTop: Styles.globalMargins.xtiny,
                maxWidth: Styles.isMobile ? 300 : undefined,
              }}
            >
              {!Styles.isMobile && <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>}
              <Kb.Text type="BodySmall">
                {Styles.isMobile ? '' : `${info.filename} `}({this.state.index + 1} of {paths.length})
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Input
            style={Styles.isMobile ? stylesInputMobile : stylesInputDesktop}
            autoFocus={true}
            floatingHintTextOverride={titleHint}
            hideLabel={Styles.isMobile}
            hintText={titleHint}
            value={info.title}
            onEnterKeyDown={this._onNext}
            ref={this._setRef}
            onChangeText={this._updateTitle}
            selectTextOnFocus={true}
          />
          <Kb.ButtonBar style={{flexShrink: 0}}>
            <Kb.Button type="Secondary" onClick={this.props.onCancel} label="Cancel" />
            {this._isLast() ? (
              <Kb.WaitingButton type="Primary" waitingKey={null} onClick={this._onNext} label="Send" />
            ) : (
              <Kb.Button type="Primary" onClick={this._onNext} label="Next" />
            )}
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.ScrollView>
    )
  }
}

const stylesDesktop = {
  ...Styles.globalStyles.flexBoxColumn,
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
  marginTop: 40,
  width: 460,
}

const stylesMobile = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'flex-start',
  marginTop: 4,
}

const stylesInputMobile = {
  minWidth: 320,
  paddingLeft: 20,
  paddingRight: 20,
}

export default Kb.HeaderOrPopup(GetTitles)
