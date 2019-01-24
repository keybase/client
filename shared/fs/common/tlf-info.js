// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

export type Props = {
  mode: 'row' | 'default',
  // false: no reset
  // true: curren tuser is reset
  // array: other user(s) are reset
  reset: boolean | Array<string>,
}

const getResetText = (names: Array<string>): string => {
  if (names.length === 1) {
    return `${names[0]} has reset their account.`
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} have reset their accounts.`
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} have reset their accounts.`
}

const TlfInfo = (props: Props) =>
  !!props.reset && (
    <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={props.mode === 'default'}>
      {props.reset === true ? (
        <Kb.Text
          type="BodySmallError"
          style={props.mode === 'default' ? styles.textDefault : styles.textRow}
          lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
        >
          Participants have to let you back in.
        </Kb.Text>
      ) : (
        <>
          {props.mode === 'row' && (
            <Kb.Meta title="reset" backgroundColor={Styles.globalColors.red} style={styles.meta} />
          )}
          <Kb.Text
            type="BodySmall"
            style={props.mode === 'default' ? styles.textDefault : styles.textRow}
            lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
          >
            {getResetText(props.reset)}
          </Kb.Text>
        </>
      )}
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  meta: {
    marginRight: Styles.globalMargins.tiny,
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
})

export default TlfInfo
