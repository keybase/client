import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import clamp from 'lodash/clamp'
import type {Props} from '.'
import {ModalTitle} from '@/teams/common'
import KB2 from '@/util/electron.desktop'
import './edit-avatar.css'
const {isDirectory} = KB2.functions

const AVATAR_CONTAINER_SIZE = 300

const validDrag = (e: React.DragEvent) => {
  return Array.from(e.dataTransfer.types)
    .map(t => t)
    .includes('Files')
}

const getFile = async (fileList: FileList | undefined): Promise<string> => {
  const paths = fileList?.length ? Array.from(fileList).map(f => f.path) : undefined
  if (!paths?.length) {
    return ''
  }
  for (const path of paths) {
    try {
      const isDir = await (isDirectory?.(path) ?? Promise.resolve(false))
      if (isDir) {
        return ''
      }
    } catch {}
  }
  return paths.pop() ?? ''
}

type Crop = {
  height: number
  width: number
  x: number
  y: number
  scale: number
}
const getCropCoordinates = (c: Crop) => {
  const {x, y, scale, width, height} = c
  const maxX = width / scale
  const maxY = height / scale
  const windowScaled = Math.round(AVATAR_CONTAINER_SIZE / scale)
  let x0 = x / scale
  x0 = clamp(Math.round(x0), 0, maxX)
  const x1 = Math.min(x0 + windowScaled, maxX)
  let y0 = y / scale
  y0 = clamp(Math.round(y0), 0, maxY)
  const y1 = Math.min(y0 + windowScaled, maxY)
  return {x0, x1, y0, y1}
}

type Loading = undefined | 'loading' | 'loaded'
const EditAvatar = (p: Props) => {
  const {onClose, wizard, showBack, onBack, onSkip, type, error, teamID, createdTeam, teamname} = p
  const [serror, setSerror] = React.useState(false)
  const [dropping, setDropping] = React.useState(false)
  const [loading, setLoading] = React.useState<Loading>()
  const [imageSource, setImageSource] = React.useState('')

  const fileRef = React.useRef<HTMLInputElement>(null)

  const onSave = () => {
    const crop = getCropCoordinates(cropRef.current)
    p.onSave(imageSource, crop)
  }
  const cropRef = React.useRef({height: 0, scale: 0, width: 0, x: 0, y: 0})
  const onChanged = (e: Crop) => {
    cropRef.current = e
  }

  const onImageLoad = () => {
    setLoading('loaded')
  }
  const onDrop = (e: React.DragEvent) => {
    const f = async () => {
      if (!validDrag(e)) {
        return
      }
      setDropping(false)
      setSerror(false)
      setLoading('loading')
      const img = await getFile(e.dataTransfer.files)
      if (img) {
        setImageSource(img)
      }
    }
    C.ignorePromise(f())
  }
  const filePickerOpen = () => {
    fileRef.current?.click()
  }
  const pickFile = () => {
    const f = async () => {
      setSerror(false)
      setLoading('loading')
      const img = await getFile(fileRef.current?.files ?? undefined)
      if (img) {
        setImageSource(img)
      }
      if (fileRef.current) {
        fileRef.current.value = ''
      }
    }
    C.ignorePromise(f())
  }

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{
        leftButton: wizard || showBack ? <Kb.Icon type="iconfont-arrow-left" onClick={onBack} /> : null,
        rightButton: wizard ? (
          <Kb.Button
            label="Skip"
            mode="Secondary"
            onClick={onSkip}
            style={styles.skipButton}
            type="Default"
          />
        ) : null,
        title: type === 'team' ? <ModalTitle teamID={teamID} title="Upload an avatar" /> : 'Upload an avatar',
      }}
      allowOverflow={true}
      footer={{
        content: (
          <Kb.WaitingButton
            fullWidth={true}
            label={wizard ? 'Continue' : 'Save'}
            onClick={onSave}
            disabled={loading !== 'loaded'}
          />
        ),
      }}
      banners={
        <>
          {error ? (
            <Kb.Banner color="red" key="propsError">
              {error}
            </Kb.Banner>
          ) : null}
          {serror ? (
            <Kb.Banner color="red" key="stateError">
              The image you uploaded could not be read. Try again with a valid PNG, JPG or GIF.
            </Kb.Banner>
          ) : null}
        </>
      }
    >
      <div
        className={Kb.Styles.classNames({dropping: dropping})}
        onDrop={onDrop}
        style={Kb.Styles.collapseStylesDesktop([
          styles.container,
          createdTeam && styles.paddingTopForCreatedTeam,
        ])}
      >
        {type === 'team' && createdTeam && !wizard && (
          <Kb.Box style={styles.createdBanner}>
            <Kb.Text type="BodySmallSemibold" negative={true}>
              Hoorah! Your team {teamname} was created.
            </Kb.Text>
          </Kb.Box>
        )}
        <Kb.Text center={true} type="Body" style={styles.instructions}>
          Drag and drop a {type} avatar or{' '}
          <Kb.Text type="BodyPrimaryLink" className="hover-underline" onClick={filePickerOpen}>
            browse your computer
          </Kb.Text>{' '}
          for one.
        </Kb.Text>
        <Kb.Box
          className={Kb.Styles.classNames('hoverbox', {filled: loading !== 'loaded'})}
          onClick={!loading ? filePickerOpen : undefined}
          style={{
            borderRadius: type === 'team' ? 32 : AVATAR_CONTAINER_SIZE,
            ...hoverStyles.hoverContainer,
          }}
        >
          <input
            accept="image/gif,image/jpeg,image/png"
            multiple={false}
            onChange={pickFile}
            ref={fileRef}
            style={styles.hidden}
            type="file"
          />
          <Kb.ZoomableImage
            dragPan={true}
            src={imageSource}
            onChanged={onChanged}
            onLoaded={onImageLoad}
            boxCacheKey="avatar"
          />
          {!loading && (
            <Kb.Icon
              className="icon"
              color={Kb.Styles.globalColors.greyDark}
              fontSize={48}
              style={styles.icon}
              type="iconfont-camera"
            />
          )}
        </Kb.Box>
        {loading === 'loaded' ? <Kb.Text type="Body">Click to select. Scroll to zoom.</Kb.Text> : null}
      </div>
    </Kb.Modal>
  )
}

const hoverStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      hoverContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          height: AVATAR_CONTAINER_SIZE,
          marginBottom: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.medium,
          outlineStyle: 'dotted',
          outlineWidth: 4,
          overflow: 'hidden',
          position: 'relative',
          width: AVATAR_CONTAINER_SIZE,
        },
        isElectron: {
          cursor: 'pointer',
        },
      }),
    }) as const
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flexGrow: 1,
    paddingTop: Kb.Styles.globalMargins.small,
  },
  createdBanner: {
    backgroundColor: Kb.Styles.globalColors.green,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: Kb.Styles.globalMargins.large,
    paddingBottom: Kb.Styles.globalMargins.xsmall,
    paddingTop: Kb.Styles.globalMargins.xsmall,
    textAlign: 'center',
    width: '100%',
  },
  hidden: {display: 'none'},
  icon: {
    left: '50%',
    marginLeft: -24,
    marginTop: -21,
    position: 'absolute',
    top: '50%',
  },
  instructions: {maxWidth: 200},
  paddingTopForCreatedTeam: {paddingTop: Kb.Styles.globalMargins.xlarge},
  skipButton: {minWidth: 60},
}))

export default EditAvatar
