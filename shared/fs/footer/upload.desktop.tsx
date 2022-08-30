import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {isDarwin} from '../../constants/platform'
import type {UploadProps} from './upload'
import capitalize from 'lodash/capitalize'
import './upload.css'

type DrawState = 'showing' | 'hiding' | 'hidden'
const Upload = React.memo(function Upload(props: UploadProps) {
  const {smallMode, showing, files, fileName, totalSyncingBytes, timeLeft, debugToggleShow} = props
  const [drawState, setDrawState] = React.useState<DrawState>(showing ? 'showing' : 'hidden')

  const height = 40

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

  // this is due to the fact that the parent container has a marginTop of -13 on darwin
  const offset = smallMode && isDarwin ? 13 : 0

  return (
    <>
      {!!debugToggleShow && (
        <Kb.Button
          onClick={debugToggleShow}
          label="Toggle"
          style={Styles.collapseStyles([styles.toggleButton, {bottom: height}])}
        />
      )}
      {drawState !== 'hidden' && (
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          className="upload-animation-loop"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.stylesBox,
            {bottom: showing ? offset : offset - height, height, maxHeight: height},
          ])}
        >
          {smallMode ? (
            <Kb.Text key="files" type="BodySemibold" style={styles.textOverflow} lineClamp={1}>
              {files
                ? fileName
                  ? `Encrypting ${fileName}.`
                  : `Encrypting ${files} items.`
                : totalSyncingBytes
                ? 'Encrypting items.'
                : 'Done!'}
              {timeLeft ? ` ${capitalize(timeLeft)} left` : ''}
            </Kb.Text>
          ) : (
            <>
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
            </>
          )}
        </Kb.Box2>
      )}
    </>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      stylesBox: Styles.platformStyles({
        isElectron: {
          backgroundImage: Styles.backgroundURL('upload-pattern-80.png'),
          flexShrink: 0, // need this to be whole in menubar
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
      toggleButton: {position: 'absolute'},
    } as const)
)

export default Upload
