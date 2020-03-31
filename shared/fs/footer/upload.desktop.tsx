import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {UploadProps} from './upload'
import './upload.css'

const height = 40

type DrawState = 'showing' | 'hiding' | 'hidden'
const Upload = React.memo(
  ({showing, files, fileName, totalSyncingBytes, timeLeft, debugToggleShow}: UploadProps) => {
    const [drawState, setDrawState] = React.useState<DrawState>(showing ? 'showing' : 'hidden')
    React.useEffect(() => {
      let id: undefined | ReturnType<typeof setTimeout>
      if (showing) {
        setDrawState('showing')
      } else {
        setDrawState('hiding')
        id = setTimeout(() => {
          setDrawState('hidden')
        }, 300)
      }
      return () => {
        id && clearTimeout(id)
      }
    }, [showing])

    return (
      <>
        {!!debugToggleShow && (
          <Kb.Button onClick={debugToggleShow} label="Toggle" style={styles.toggleButton} />
        )}
        {drawState !== 'hidden' && (
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            className="upload-animation-loop"
            fullWidth={true}
            style={Styles.collapseStyles([styles.stylesBox, {bottom: showing ? 0 : -height}])}
          >
            <Kb.Text key="files" type="BodySemibold" style={styles.textOverflow}>
              {files
                ? fileName
                  ? `Encrypting and updating ${fileName}...`
                  : `Encrypting and updating ${files} items...`
                : totalSyncingBytes
                ? 'Encrypting and updating items...'
                : 'Done!'}
            </Kb.Text>
            {!!(timeLeft && timeLeft.length) && (
              <Kb.Text key="left" type="BodySmall" style={styles.stylesText}>{`${timeLeft} left`}</Kb.Text>
            )}
          </Kb.Box2>
        )}
      </>
    )
  }
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      stylesBox: Styles.platformStyles({
        isElectron: {
          backgroundImage: Styles.backgroundURL('upload-pattern-80.png'),
          flexShrink: 0, // need this to be whole in menubar
          height,
          maxHeight: height,
          paddingLeft: Styles.globalMargins.medium,
          paddingRight: Styles.globalMargins.medium,
          position: 'absolute',
        },
      }),
      stylesText: {
        color: Styles.globalColors.whiteOrWhite,
      },
      textOverflow: Styles.platformStyles({
        isElectron: {
          color: Styles.globalColors.whiteOrWhite,
          maxWidth: '100%',
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      toggleButton: {
        bottom: height,
        position: 'absolute',
      },
    } as const)
)

export default Upload
