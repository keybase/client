import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import {formatTimeForFS} from '@/util/timestamp'
import {useFsTlfs} from './hooks'
import {useCurrentUserState} from '@/stores/current-user'

export type OwnProps = {
  path: T.FS.Path
  mixedMode?: boolean
  mode: 'row' | 'default'
}

type Props = {
  isNew: boolean
  mixedMode?: boolean
  mode: 'row' | 'default'
  reset: boolean | ReadonlyArray<string>
  tlfMtime: number
  tlfType: T.FS.Visibility
}

const getOtherResetText = (names: ReadonlyArray<string>): string => {
  if (names.length === 1) {
    return `${names[0]} has reset or deleted their account.`
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} have reset or deleted their accounts.`
  }
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)} have reset or deleted their accounts.`
}

const newMetaMaybe = (props: Props, styles: ReturnType<typeof useStyles>) =>
  props.mode === 'row' && props.isNew ? (
    <Kb.Meta
      variant="new"
      style={Kb.Styles.collapseStyles([styles.meta, {marginRight: Kb.Styles.globalMargins.xtiny}])}
    />
  ) : null

const resetMetaMaybe = (props: Props, styles: ReturnType<typeof useStyles>) =>
  props.mode === 'row' && props.reset === true ? (
    <Kb.Meta variant="reset" style={styles.meta} />
  ) : null

const resetText = (props: Props, styles: ReturnType<typeof useStyles>) => {
  const text =
    props.reset === true
      ? 'Participants have to let you back in.'
      : props.reset
        ? getOtherResetText(props.reset)
        : null
  return text ? (
    <Kb.Text
      type="BodySmallError"
      style={props.mode === 'default' ? styles.textDefault : styles.textRow}
      lineClamp={props.mode === 'row' && isMobile ? 1 : undefined}
    >
      {text}
    </Kb.Text>
  ) : null
}

const getPrefixText = (props: Props, styles: ReturnType<typeof useStyles>) =>
  props.mixedMode && props.tlfType ? (
    <Kb.Box2 direction="horizontal" gap="xtiny" gapEnd={true}>
      <Kb.Text
        type="BodySmall"
        style={props.mode === 'default' ? styles.textDefault : styles.textRow}
        lineClamp={props.mode === 'row' && isMobile ? 1 : undefined}
      >
        {props.tlfType}/
      </Kb.Text>
    </Kb.Box2>
  ) : null

const timeText = (props: Props, styles: ReturnType<typeof useStyles>) =>
  props.tlfMtime ? (
    <Kb.Text
      type="BodySmall"
      style={props.mode === 'default' ? styles.textDefault : styles.textRow}
      lineClamp={props.mode === 'row' && isMobile ? 1 : undefined}
    >
      {formatTimeForFS(props.tlfMtime, props.mode !== 'row')}
    </Kb.Text>
  ) : null

const getText = (props: Props, styles: ReturnType<typeof useStyles>) => {
  if (isMobile && props.mixedMode) {
    // on mobile in fs root, don't show reset text, and only show time text
    // if reset badge isn't shown, i.e. not self reset
    return props.reset !== true ? timeText(props, styles) : null
  }

  // in mixed mode, reset text takes higher priority
  if (props.mixedMode) {
    return props.reset ? resetText(props, styles) : timeText(props, styles)
  }

  // otherwise, show reset text if we need, and don't show time text.
  return props.reset ? resetText(props, styles) : null
}

const TlfInfoLine = (ownProps: OwnProps) => {
  const styles = useStyles()
  const _tlf = FS.getTlfFromPath(useFsTlfs(), ownProps.path)
  const _username = useCurrentUserState(s => s.username)
  const resetParticipants = _tlf === FS.unknownTlf ? undefined : _tlf.resetParticipants
  const props: Props = {
    isNew: _tlf.isNew,
    mixedMode: ownProps.mixedMode,
    mode: ownProps.mode,
    reset:
      !!resetParticipants &&
      !!resetParticipants.length &&
      (resetParticipants.includes(_username) || resetParticipants),
    tlfMtime: _tlf.tlfMtime,
    tlfType: T.FS.getPathVisibility(ownProps.path),
  }
  const prefix = getPrefixText(props, styles)
  const dot = (
    <Kb.Text
      type="BodySmall"
      style={props.mode === 'default' ? styles.textDefault : styles.textRow}
      lineClamp={props.mode === 'row' && isMobile ? 1 : undefined}
    >
      •&nbsp;
    </Kb.Text>
  )

  const newMeta = newMetaMaybe(props, styles)
  const resetMeta = resetMetaMaybe(props, styles)
  const text = getText(props, styles)
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      centerChildren={props.mode === 'default'}
      alignItems="center"
    >
      {newMeta}
      {prefix}
      {prefix && (resetMeta || text) ? dot : null}
      {resetMeta}
      {text}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      meta: {
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
      textDefault: {
        flexShrink: 1,
        textAlign: 'center',
      },
      textRow: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.textEllipsis,
        },
        isMobile: {
          flexShrink: 1,
        },
      }),
    }) as const
)

export default TlfInfoLine
