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

  _onNext = (e: React.SyntheticEvent) => {
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

  render() {
    const paths = Object.keys(this.state.pathToInfo)
    const path = paths[this.state.index]
    const info = this.state.pathToInfo[path]
    const titleHint = 'Caption (optional)'
    if (!info) return null

    return (
      <Kb.ScrollView style={styles.scrollView}>
        <Kb.Box style={styles.container}>
          <Kb.Box style={styles.imageContainer}>
            {info.type === 'image' ? (
              <Kb.OrientedImage
                src={Styles.isAndroid ? `file://${path}` : path}
                style={styles.image}
              />
            ) : (
              <Kb.Icon type="icon-file-uploading-48" />
            )}
          </Kb.Box>
          {paths.length > 0 && !Styles.isMobile && (
            <Kb.Box2
              direction="vertical"
              style={styles.filename}
            >
              <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>
              <Kb.Text type="BodySmall">
                {info.filename} ({this.state.index + 1} of {paths.length})
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.PlainInput
            style={styles.input}
            autoFocus={true}
            placeholder={titleHint}
            multiline={true}
            value={info.title}
            onEnterKeyDown={this._onNext}
            onChangeText={this._updateTitle}
            selectTextOnFocus={true}
          />
          <Kb.ButtonBar style={{flexShrink: 0}}>
            {!Styles.isMobile && <Kb.Button type="Dim" onClick={this.props.onCancel} label="Cancel" />}
            {this._isLast() ? (
              <Kb.WaitingButton fullWidth={Styles.isMobile} waitingKey={null} onClick={this._onNext} label="Send" />
            ) : (
              <Kb.Button onClick={this._onNext} label="Next" />
            )}
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.ScrollView>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      // marginBottom: 80,
      // marginLeft: 80,
      // marginRight: 80,
      // marginTop: 90,
    },
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-start',
      marginTop: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
  }),
  filename: Styles.platformStyles({
    common: {
      alignItems: 'center',
      marginTop: Styles.globalMargins.xtiny,
    },
    isMobile: {
      maxWidth: 150,
    },
  }),
  image: Styles.platformStyles({
    isMobile: {
      height: 150,
      width: 150,
    },
    isElectron: {
      maxHeight: '100%',
      maxWidth: '100%',
    },
  }),
  imageContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxCenter,
    },
    isElectron: {
      maxHeight: 300,
      maxWidth: 300,
    },
    isMobile: {
      height: 150,
      width: 150,
    },
  }),
  input: Styles.platformStyles({
    isElectron: {
      flexShrink: 0,
      marginTop: 40,
      width: 460,
    },
    isMobile: {
      borderColor: Styles.globalColors.blue,
      borderRadius: Styles.borderRadius,
      borderWidth: 1,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
      width: '100%',
    },
  }),
  scrollView: Styles.platformStyles({
    common: {
      height: '100%',
      width: '100%',
    },
    isMobile: {
      backgroundColor: Styles.globalColors.blueGrey,
    },
  }),
})

export default Kb.HeaderOrPopup(GetTitles)
