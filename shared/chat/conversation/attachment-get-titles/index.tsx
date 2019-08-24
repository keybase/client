import * as React from 'react'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../common-adapters/index'
import * as Styles from '../../../styles'

export type PathToInfo = {
  [K in string]: {
    type: 'image' | 'file'
    title: string
    filename: string
    outboxID: RPCChatTypes.OutboxID
  }
}

type Props = {
  pathToInfo: PathToInfo
  onCancel: () => void
  onSubmit: (pathToInfo: PathToInfo) => void
}

type State = {
  index: number
  pathToInfo: PathToInfo
}

class GetTitles extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      index: 0,
      pathToInfo: props.pathToInfo,
    }
  }

  _onNext = (e?: React.BaseSyntheticEvent) => {
    e && e.preventDefault()

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

  render() {
    const paths = Object.keys(this.state.pathToInfo)
    const path = paths[this.state.index]
    const info = this.state.pathToInfo[path]
    const titleHint = 'Caption (optional)'
    if (!info) return null

    return (
      <Kb.Box2 direction="vertical" style={styles.containerOuter} fullHeight={true} fullWidth={true}>
        <Kb.ScrollView style={styles.scrollView} contentContainerStyle={Styles.globalStyles.fullHeight}>
          <Kb.Box2
            alignItems="center"
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            style={styles.container}
          >
            <Kb.Box2 alignItems="center" direction="vertical" style={styles.imageContainer}>
              {info.type === 'image' ? (
                <Kb.OrientedImage src={Styles.isAndroid ? `file://${path}` : path} style={styles.image} />
              ) : (
                <Kb.Icon type="icon-file-uploading-48" />
              )}
            </Kb.Box2>
            {paths.length > 0 && !Styles.isMobile && (
              <Kb.Box2 direction="vertical" style={styles.filename}>
                <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>
                <Kb.Text type="BodySmall">
                  {info.filename} ({this.state.index + 1} of {paths.length})
                </Kb.Text>
              </Kb.Box2>
            )}
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
              <Kb.PlainInput
                style={styles.input}
                autoFocus={true}
                autoCorrect={true}
                placeholder={titleHint}
                multiline={true}
                rowsMin={2}
                value={info.title}
                onEnterKeyDown={this._onNext}
                onChangeText={this._updateTitle}
                selectTextOnFocus={true}
              />
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ScrollView>
        <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
          {!Styles.isMobile && (
            <Kb.Button fullWidth={true} type="Dim" onClick={this.props.onCancel} label="Cancel" />
          )}
          {this._isLast() ? (
            <Kb.WaitingButton fullWidth={true} waitingKey={null} onClick={this._onNext} label="Send" />
          ) : (
            <Kb.Button fullWidth={true} onClick={this._onNext} label="Next" />
          )}
        </Kb.ButtonBar>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  buttonContainer: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-end',
      borderStyle: 'solid',
      borderTopColor: Styles.globalColors.black_10,
      borderTopWidth: 1,
      flexShrink: 0,
      padding: Styles.globalMargins.small,
    },
    isMobile: Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small, 0),
  }),
  cancelButton: {marginRight: Styles.globalMargins.tiny},
  container: Styles.platformStyles({
    isElectron: {justifyContent: 'space-between'},
    isMobile: {
      justifyContent: 'space-around',
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  containerOuter: Styles.platformStyles({
    isElectron: {
      height: 560,
      width: 400,
    },
  }),
  filename: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      marginBottom: Styles.globalMargins.small,
    },
  }),
  image: Styles.platformStyles({
    isElectron: {
      maxHeight: '100%',
      maxWidth: '100%',
    },
    isMobile: {
      height: 125,
      marginBottom: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.tiny,
      width: 150,
    },
  }),
  imageContainer: Styles.platformStyles({
    common: {justifyContent: 'center'},
    isElectron: {
      flex: 1,
      height: 325,
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
      width: 325,
    },
    isMobile: {
      height: 150,
      width: 150,
    },
  }),
  input: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.blue,
      borderRadius: Styles.borderRadius,
      borderWidth: 1,
      marginBottom: Styles.globalMargins.tiny,
      // RN wasn't obeying `padding: Styles.globalMargins.tiny`.
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
      width: '100%',
    },
    isElectron: {maxHeight: 100},
  }),
  inputContainer: Styles.platformStyles({
    isElectron: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  scrollView: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
      height: '100%',
      width: '100%',
    },
    isElectron: {borderRadius: Styles.borderRadius},
  }),
})

export default Kb.HeaderOrPopup(GetTitles)
