import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

export type Info = {
  type: 'image' | 'file' | 'video'
  title: string
  filename: string
  outboxID: RPCChatTypes.OutboxID | null
}

type PathAndInfo = {
  path: string
  info: Info
}

type Props = {
  pathAndInfos: Array<PathAndInfo>
  onCancel: () => void
  onSubmit: (titles: Array<string>) => void
}

type State = {
  index: number
  titles: Array<string>
}

class GetTitles extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      index: 0,
      titles: props.pathAndInfos.map(() => ''),
    }
  }

  _onNext = (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault()

    const {info} = this.props.pathAndInfos[this.state.index]
    if (!info) return

    const nextIndex = this.state.index + 1

    // done
    if (nextIndex === this.props.pathAndInfos.length) {
      this.props.onSubmit(this.state.titles)
    } else {
      // go to next
      this.setState({index: nextIndex})
    }
  }

  _onSubmit = (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault()
    this.props.onSubmit(this.state.titles)
  }

  _isLast = () => {
    const numPaths = this.props.pathAndInfos.length
    return this.state.index + 1 === numPaths
  }

  // Are we trying to upload multiple?
  _multiUpload = () => {
    return this.props.pathAndInfos.length > 1
  }

  _updateTitle = (title: string) => {
    this.setState(state => ({
      titles: [...state.titles.slice(0, state.index), title, ...state.titles.slice(state.index + 1)],
    }))
  }

  render() {
    const {info, path} = this.props.pathAndInfos[this.state.index] ?? {}
    const titleHint = 'Add a caption...'
    if (!info) return null

    let preview: React.ReactNode = null
    switch (info.type) {
      case 'image':
        preview = <Kb.ZoomableImage src={Styles.isAndroid ? `file://${path}` : path} style={styles.image} />
        break
      case 'video':
        preview = (
          <Kb.Video
            allowFile={true}
            muted={true}
            url={Styles.isAndroid ? `${path.substring(2)}` : `file://${encodeURI(path)}`}
          />
        )
        break
      default:
        preview = (
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
            <Kb.Icon type="icon-file-uploading-48" />
          </Kb.Box2>
        )
    }

    return (
      <Kb.PopupWrapper onCancel={this.props.onCancel}>
        <Kb.Box2 direction="vertical" style={styles.containerOuter} fullWidth={true}>
          <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} style={styles.container}>
            <Kb.BoxGrow style={styles.boxGrow}>{preview}</Kb.BoxGrow>
            {this.props.pathAndInfos.length > 0 && !Styles.isMobile && (
              <Kb.Box2 direction="vertical" style={styles.filename}>
                <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>
                <Kb.Text type="BodySmall" center={true}>
                  {info.filename} ({this.state.index + 1} of {this.props.pathAndInfos.length})
                </Kb.Text>
              </Kb.Box2>
            )}
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
              <Kb.PlainInput
                style={styles.input}
                autoFocus={!Styles.isMobile}
                autoCorrect={true}
                placeholder={titleHint}
                multiline={true}
                rowsMin={2}
                padding="tiny"
                value={this.state.titles[this.state.index]}
                onEnterKeyDown={this._onNext}
                onChangeText={this._updateTitle}
                selectTextOnFocus={true}
              />
            </Kb.Box2>
          </Kb.Box2>
          <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
            {!Styles.isMobile && (
              <Kb.Button fullWidth={true} type="Dim" onClick={this.props.onCancel} label="Cancel" />
            )}
            {this._isLast() ? (
              <Kb.WaitingButton
                fullWidth={!this._multiUpload()}
                waitingKey={null}
                onClick={this._onSubmit}
                label="Send"
              />
            ) : (
              <Kb.Button fullWidth={!this._multiUpload()} onClick={this._onNext} label="Next" />
            )}
            {this._multiUpload() ? (
              <Kb.WaitingButton waitingKey={null} onClick={this._onSubmit} label="Send All" />
            ) : null}
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.PopupWrapper>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      boxGrow: {
        margin: Styles.globalMargins.small,
        overflow: 'hidden',
        width: '100%',
      },
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
      container: {
        flexGrow: 1,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      containerOuter: Styles.platformStyles({
        isElectron: {
          height: 560,
          width: 400,
        },
        isMobile: {flexGrow: 1},
      }),
      filename: Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          marginBottom: Styles.globalMargins.small,
        },
      }),
      image: {
        height: '100%',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
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
          height: '100%',
          width: '100%',
        },
      }),
      input: Styles.platformStyles({
        common: {
          borderColor: Styles.globalColors.blue,
          borderRadius: Styles.borderRadius,
          borderWidth: 1,
          marginBottom: Styles.globalMargins.tiny,
          maxHeight: 42,
          minHeight: 42,
          width: '100%',
        },
        isTablet: {
          alignSelf: 'center',
          maxWidth: 460,
        },
      }),
      inputContainer: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      nonImage: {
        alignSelf: 'center',
        justifyContentSelf: 'center',
      },
      scrollView: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueGrey,
          height: '100%',
          width: '100%',
        },
        isElectron: {borderRadius: Styles.borderRadius},
      }),
    } as const)
)

export default GetTitles
