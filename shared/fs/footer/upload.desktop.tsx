import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {UploadProps} from './upload'
import './upload.css'

const height = 40

const Upload = React.memo(
  ({showing, files, fileName, totalSyncingBytes, timeLeft, debugToggleShow}: UploadProps) => {
    const backgroundImage = React.useMemo(() => Styles.backgroundURL('upload-pattern-80.png'), [])
    return (
      <>
        {!!debugToggleShow && (
          <Kb.Button
            onClick={debugToggleShow}
            label="Toggle"
            style={{position: 'absolute', bottom: height}}
          />
        )}
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          className="upload-animation-loop"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.stylesBox,
            {backgroundImage, position: 'absolute', bottom: showing ? 0 : -height},
          ])}
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
      </>
    )
  }
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      stylesBox: {
        flexShrink: 0, // need this to be whole in menubar
        height,
        maxHeight: height,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
      },
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
    } as const)
)

export default Upload
