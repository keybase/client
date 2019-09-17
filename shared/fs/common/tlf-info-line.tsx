import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import {formatTimeForFS} from '../../util/timestamp'

export type Props = {
  mixedMode?: boolean
  mode: 'row' | 'default'
  reset: boolean | Array<string>
  tlfMtime: number
  tlfType: Types.Visibility
}

const getOtherResetText = (names: Array<string>): string => {
  if (names.length === 1) {
    return `${names[0]} has reset their account.`
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} have reset their accounts.`
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} have reset their accounts.`
}

const resetMetaMaybe = (props: Props) =>
  props.mode === 'row' && props.reset === true ? (
    <Kb.Meta title="reset" backgroundColor={Styles.globalColors.red} style={styles.meta} />
  ) : null

const resetText = (props: Props) => {
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
      lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
    >
      {text}
    </Kb.Text>
  ) : null
}

const PrefixText = (props: Props) =>
  props.mixedMode && props.tlfType ? (
    <Kb.Box2 direction="horizontal" gap="xtiny" gapEnd={true}>
      <Kb.Text
        type="BodySmall"
        style={props.mode === 'default' ? styles.textDefault : styles.textRow}
        lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
      >
        {props.tlfType}/
      </Kb.Text>
    </Kb.Box2>
  ) : null

const timeText = (props: Props) =>
  props.tlfMtime ? (
    <Kb.Text
      type="BodySmall"
      style={props.mode === 'default' ? styles.textDefault : styles.textRow}
      lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
    >
      {formatTimeForFS(props.tlfMtime, props.mode !== 'row')}
    </Kb.Text>
  ) : null

const getText = (props: Props) => {
  if (Styles.isMobile && props.mixedMode) {
    // on mobile in fs root, don't show reset text, and only show time text
    // if reset badge isn't shown, i.e. not self reset
    return props.reset !== true ? timeText(props) : null
  }

  // in mixed mode, reset text takes higher priority
  if (props.mixedMode) {
    return props.reset ? resetText(props) : timeText(props)
  }

  // otherwise, show reset text if we need, and don't show time text.
  return props.reset ? resetText(props) : null
}

const TlfInfoLine = (props: Props) => {
  const prefix = <PrefixText {...props} />
  const dot = (
    <Kb.Text
      type="BodySmall"
      style={props.mode === 'default' ? styles.textDefault : styles.textRow}
      lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
    >
      •&nbsp;
    </Kb.Text>
  )

  const reset = resetMetaMaybe(props)
  const text = getText(props)
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      centerChildren={props.mode === 'default'}
      alignItems="center"
    >
      {prefix}
      {prefix && (reset || text) ? dot : null}
      {reset}
      {text}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      meta: {
        alignSelf: 'center',
        marginRight: Styles.globalMargins.xtiny,
      },
      textDefault: {
        textAlign: 'center',
      },
      textRow: Styles.platformStyles({
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
    } as const)
)

export default TlfInfoLine
