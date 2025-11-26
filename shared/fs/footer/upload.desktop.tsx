import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {UploadProps} from './upload'
import capitalize from 'lodash/capitalize'
import {getAssetPath} from '@/constants/platform.desktop'
import * as Path from '@/util/path'
import './upload.css'
import {useColorScheme} from 'react-native'

const backgroundURL = (url: string, isDarkMode: boolean) => {
  const ext = Path.extname(url)
  const goodPath = Path.basename(url, ext) ?? ''
  const guiModePath = `${isDarkMode ? 'dark-' : ''}${goodPath}`
  const images = [1, 2, 3].map(
    mult => `url('${getAssetPath('images', guiModePath)}${mult === 1 ? '' : `@${mult}x`}${ext}') ${mult}x`
  )
  return `-webkit-image-set(${images.join(', ')})`
}

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
  const offset = smallMode && C.isDarwin ? 13 : 0

  const isDarkMode = useColorScheme() === 'dark'
  return (
    <>
      {!!debugToggleShow && (
        <Kb.Button
          onClick={debugToggleShow}
          label="Toggle"
          style={Kb.Styles.collapseStyles([styles.toggleButton, {bottom: height}])}
        />
      )}
      {drawState !== 'hidden' && (
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          className="upload-animation-loop"
          fullWidth={true}
          style={Kb.Styles.collapseStyles([
            styles.stylesBox,
            Kb.Styles.platformStyles({
              isElectron: {
                backgroundImage: backgroundURL('upload-pattern-80.png', isDarkMode),
              },
            }),
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
              {!!timeLeft.length && (
                <Kb.Text key="left" type="BodySmall" style={styles.stylesText}>{`${timeLeft} left`}</Kb.Text>
              )}
            </>
          )}
        </Kb.Box2>
      )}
    </>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      stylesBox: Kb.Styles.platformStyles({
        isElectron: {
          flexShrink: 0, // need this to be whole in menubar
          paddingLeft: Kb.Styles.globalMargins.medium,
          paddingRight: Kb.Styles.globalMargins.medium,
          position: 'absolute',
        },
      }),
      stylesText: {
        color: Kb.Styles.globalColors.whiteOrWhite,
      },
      textOverflow: Kb.Styles.platformStyles({
        isElectron: {
          color: Kb.Styles.globalColors.whiteOrWhite,
          maxWidth: '100%',
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      toggleButton: {position: 'absolute'},
    }) as const
)

export default Upload
