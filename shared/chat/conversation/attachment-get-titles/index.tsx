import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {isPathHEIC} from '@/constants/chat2'

export type Info = {
  type: 'image' | 'file' | 'video'
  title: string
  filename: string
  outboxID?: T.RPCChat.OutboxID
  url?: string
}

type PathAndInfo = {
  path: string
  info: Info
}

type Props = {
  pathAndInfos: Array<PathAndInfo>
  titles?: Array<string>
  onCancel: () => void
  onSubmit: (titles: Array<string>, spoiler: boolean) => void
}

const GetTitles = (p: Props) => {
  const {pathAndInfos, titles: _titles, onSubmit: _onSubmit, onCancel} = p
  const [index, setIndex] = React.useState(0)
  const [titles, setTitles] = React.useState(pathAndInfos.map((_, idx) => _titles?.[idx] ?? ''))
  const [spoiler, setSpoiler] = React.useState(false)
  setSpoiler // TODO commented out

  const onNext = React.useCallback(
    (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault()

      const {info} = pathAndInfos[index] ?? {}
      if (!info) return

      const nextIndex = index + 1

      // done
      if (nextIndex === pathAndInfos.length) {
        _onSubmit(titles, spoiler)
      } else {
        // go to next
        setIndex(s => s + 1)
      }
    },
    [index, pathAndInfos, titles, spoiler, setIndex, _onSubmit]
  )

  const onSubmit = React.useCallback(
    (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault()
      _onSubmit(titles, spoiler)
    },
    [_onSubmit, titles, spoiler]
  )

  const updateTitle = React.useCallback(
    (title: string) => {
      setTitles([...titles.slice(0, index), title, ...titles.slice(index + 1)])
    },
    [index, titles]
  )

  const {info, path} = pathAndInfos[index] ?? {}
  const titleHint = 'Add a caption...'
  if (!info) return null

  let preview: React.ReactNode = null
  switch (info.type) {
    case 'image':
      preview = path ? (
        <Kb.ZoomableImage src={info.url ?? path} style={styles.image} boxCacheKey="getTitlesImg" />
      ) : null
      break
    case 'video':
      preview = path ? <Kb.Video autoPlay={false} allowFile={true} muted={true} url={path} /> : null
      break
    default: {
      if (C.isIOS && path && isPathHEIC(path)) {
        preview = <Kb.ZoomableImage src={path} style={styles.image} boxCacheKey="getTitlesHeicImg" />
      } else {
        preview = (
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
            <Kb.Icon type="icon-file-uploading-48" />
          </Kb.Box2>
        )
      }
    }
  }

  const isLast = index + 1 === pathAndInfos.length
  // Are we trying to upload multiple?
  const multiUpload = pathAndInfos.length > 1

  return (
    <Kb.PopupWrapper onCancel={onCancel}>
      <Kb.Box2 direction="vertical" style={styles.containerOuter} fullWidth={true}>
        <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.BoxGrow style={styles.boxGrow}>{preview}</Kb.BoxGrow>
          {pathAndInfos.length > 0 && !Styles.isMobile && (
            <Kb.Box2 direction="vertical" style={styles.filename}>
              <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>
              <Kb.Text type="BodySmall" center={true}>
                {info.filename} ({index + 1} of {pathAndInfos.length})
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
              value={titles[index]}
              onEnterKeyDown={onNext}
              onChangeText={updateTitle}
              selectTextOnFocus={true}
            />
            {/* (
                <Kb.Checkbox
                  style={{alignSelf: 'flex-end'}}
                  label="Spoiler?"
                  checked={spoiler}
                  onCheck={setSpoiler}
                />
              )*/}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
          {!Styles.isMobile && <Kb.Button fullWidth={true} type="Dim" onClick={onCancel} label="Cancel" />}
          {isLast ? (
            <Kb.WaitingButton fullWidth={!multiUpload} onClick={onSubmit} label="Send" />
          ) : (
            <Kb.Button fullWidth={!multiUpload} onClick={onNext} label="Next" />
          )}
          {multiUpload ? <Kb.WaitingButton onClick={onSubmit} label="Send All" /> : null}
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
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
    }) as const
)

export default GetTitles
