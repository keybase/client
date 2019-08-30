import * as React from 'react'
import * as Styles from '../../styles'
import SubHeading from '../subheading'
import {Box, Button, Checkbox, Divider, Text, Meta} from '../../common-adapters'
import {Stars} from '../common.desktop'
import {priceToString, planToStars, comparePlans} from '../../constants/plan-billing'
import flags from '../../util/feature-flags'

import {Props, AccountProps, PlanProps} from './index'
import {PlanLevel} from '../../constants/types/settings'
import {PaymentInfo as PaymentInfoType, AvailablePlan, ChangeType} from '../../constants/types/plan-billing'

const ROW_HEIGHT = 48

type PlanActionVariantsProps =
  | {type: 'change'; changeType: ChangeType}
  | {
      type: 'spaceInfo'
      freeSpace: string
      freeSpacePercentage: number
      lowSpaceWarning: boolean
    }

type PlanLevelProps = {
  style?: Object
  level: PlanLevel
  price: string
  gigabytes: number
  onInfo: () => void
  variants: PlanActionVariantsProps
}

function variantPropsHelper(
  selectedLevel: PlanLevel,
  otherLevel: PlanLevel,
  freeSpace: string,
  freeSpacePercentage: number,
  lowSpaceWarning: boolean,
  changeType: ChangeType
): PlanActionVariantsProps {
  if (selectedLevel === otherLevel) {
    return {
      freeSpace,
      freeSpacePercentage,
      lowSpaceWarning,
      type: 'spaceInfo',
    }
  }

  return {
    changeType: changeType,
    type: 'change',
  }
}

function SpaceInfo({
  freeSpace,
  freeSpacePercentage,
  lowSpaceWarning,
}: {
  freeSpace: string
  freeSpacePercentage: number
  lowSpaceWarning: boolean
}) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Text
        style={{color: Styles.globalColors.black_50, fontSize: 12, marginRight: Styles.globalMargins.xtiny}}
        type={'BodySmallSemibold'}
      >
        {freeSpace} FREE
      </Text>
      <Box style={{position: 'relative', width: 64}}>
        <Box style={styles.freeSpaceBar} />
        <Box
          style={{
            ...styles.freeSpaceBar,
            backgroundColor: lowSpaceWarning ? Styles.globalColors.red : Styles.globalColors.blue,
            width: Math.round(64 * freeSpacePercentage),
          }}
        />
      </Box>
    </Box>
  )
}

const UpgradeButton = ({onClick, type}: {onClick: () => void; type: 'upgrade' | 'change'}) => (
  <Button
    style={{marginRight: 0}}
    type="Success"
    label={{change: 'Change', upgrade: 'Upgrade'}[type]}
    onClick={e => {
      onClick()
      e.stopPropagation()
    }}
  />
)

const DowngradeLink = ({onClick}) => (
  <Text
    type={'BodySmall'}
    style={{color: Styles.globalColors.blueDark}}
    onClick={e => {
      onClick()
      e.stopPropagation()
    }}
  >
    Downgrade
  </Text>
)

function PlanActionVariants({variants, onClick}: {variants: PlanActionVariantsProps; onClick: () => void}) {
  switch (variants.type) {
    case 'change':
      return variants.changeType === 'downgrade' ? (
        <DowngradeLink onClick={onClick} />
      ) : (
        <UpgradeButton onClick={onClick} type={variants.changeType} />
      )
    case 'spaceInfo':
      return <SpaceInfo {...variants} />
  }
  return null
}

function PlanLevelRow({level, price, onInfo, variants, style, gigabytes}: PlanLevelProps) {
  const selected = variants.type === 'spaceInfo'
  return (
    <Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        ...Styles.desktopStyles.clickable,
        ...styles.planLevelRow,
        backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
        ...style,
      }}
      onClick={() => onInfo()}
    >
      <Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Text
            type={'BodySemibold'}
            style={{color: Styles.globalColors.blueDark, marginRight: Styles.globalMargins.xtiny}}
          >
            {level}
          </Text>
          <Text type="BodySmall">({price})</Text>
        </Box>
        {selected && <Meta title="Your Plan" backgroundColor={Styles.globalColors.blueLight} />}
      </Box>
      <Box style={{...Styles.globalStyles.flexBoxRow, flex: 1}}>
        <Text
          style={{...Styles.globalStyles.fontSemibold, marginRight: Styles.globalMargins.xtiny}}
          type="BodySmall"
        >
          {`${gigabytes}GB`}
        </Text>
        <Stars count={planToStars(level)} />
      </Box>
      <Box style={{...Styles.globalStyles.flexBoxRow, flex: 1, justifyContent: 'flex-end'}}>
        <PlanActionVariants variants={variants} onClick={onInfo} />
      </Box>
    </Box>
  )
}

function PaymentInfo({
  name,
  last4Digits,
  isBroken,
  onChangePaymentInfo,
}: PaymentInfoType & {
  onChangePaymentInfo: () => void
}) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxColumn, marginTop: Styles.globalMargins.medium}}>
      <SubHeading>Your payment method</SubHeading>
      <Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: ROW_HEIGHT,
          paddingLeft: Styles.globalMargins.xtiny,
        }}
      >
        <Box style={Styles.globalStyles.flexBoxColumn}>
          <Text type="Body">{name}</Text>
          <Text
            style={{color: isBroken ? Styles.globalColors.redDark : Styles.globalColors.black_50}}
            type="BodySmall"
          >
            **** {last4Digits} {isBroken ? ' (broken)' : ''}
          </Text>
        </Box>
        <Text type="BodySmall" style={{color: Styles.globalColors.blueDark}} onClick={onChangePaymentInfo}>
          Update
        </Text>
      </Box>
    </Box>
  )
}

function Plan({
  onInfo,
  freeSpace,
  freeSpacePercentage,
  selectedLevel,
  paymentInfo,
  onChangePaymentInfo,
  lowSpaceWarning,
  plans,
}: PlanProps & {
  plans: Array<AvailablePlan>
}) {
  const from: AvailablePlan | undefined = plans.find(
    (plan: AvailablePlan) => plan.planLevel === selectedLevel
  )
  if (!from) {
    throw new Error("Can't find existing plan")
  }

  return (
    <Box style={Styles.globalStyles.flexBoxColumn}>
      <Box style={Styles.globalStyles.flexBoxColumn}>
        <SubHeading>Your plan</SubHeading>
      </Box>
      {plans.map(p => (
        <PlanLevelRow
          key={p.planLevel}
          level={p.planLevel}
          onInfo={() => onInfo(p.planLevel)}
          price={priceToString(p.price_pennies)}
          gigabytes={p.gigabytes}
          variants={variantPropsHelper(
            selectedLevel,
            p.planLevel,
            freeSpace,
            freeSpacePercentage,
            lowSpaceWarning,
            comparePlans(from, p)
          )}
        />
      ))}
      {!!paymentInfo && <PaymentInfo {...paymentInfo} onChangePaymentInfo={onChangePaymentInfo} />}
      {!!paymentInfo && (
        <Text style={{marginTop: Styles.globalMargins.small}} type="BodySmall">
          * You only pay for data you write on Keybase. When you share a file, the recipient does not pay.
        </Text>
      )}
    </Box>
  )
}

function AccountEmail({email, onChangeEmail}: {email: string; onChangeEmail: () => void}) {
  return (
    <Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: ROW_HEIGHT,
      }}
    >
      <Box style={Styles.globalStyles.flexBoxColumn}>
        <Text type="BodySemibold">{email}</Text>
      </Box>
      <Text type="Body" style={{color: Styles.globalColors.blueDark}} onClick={onChangeEmail}>
        Edit
      </Text>
    </Box>
  )
}

function AccountFirstEmail({onChangeEmail}: {onChangeEmail: () => void}) {
  return (
    <Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
      }}
    >
      <Text type="Body" style={{marginRight: Styles.globalMargins.xtiny}}>
        Email address:
      </Text>
      <Button label="Add an email address" type="Dim" small={true} onClick={onChangeEmail} />
    </Box>
  )
}

function AccountPassword({onChangePassword}: {onChangePassword: () => void}) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', minHeight: ROW_HEIGHT}}>
      <Text type="Body" style={{marginRight: Styles.globalMargins.xtiny}}>
        Password:
      </Text>
      <Text type="Body" style={{flex: 1}}>
        •••••••••
      </Text>
      <Text type="Body" style={{color: Styles.globalColors.blueDark}} onClick={onChangePassword}>
        Edit
      </Text>
    </Box>
  )
}

function AccountFirstPassword({onChangePassword}: {onChangePassword: () => void}) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', minHeight: ROW_HEIGHT}}>
      <Text type="Body" style={{marginRight: Styles.globalMargins.xtiny}}>
        Password:
      </Text>
      <Button label="Set a password" type="Dim" small={true} onClick={onChangePassword} />
    </Box>
  )
}

function Account({
  email,
  onChangeEmail,
  onChangePassword,
  onChangeRememberPassword,
  rememberPassword,
  hasRandomPW,
}: AccountProps) {
  const Password = hasRandomPW ? AccountFirstPassword : AccountPassword
  const Email = email ? AccountEmail : AccountFirstEmail
  return (
    <Box style={{...Styles.globalStyles.flexBoxColumn, marginBottom: Styles.globalMargins.medium}}>
      <Email email={email} onChangeEmail={onChangeEmail} />
      <Divider />
      <Password onChangePassword={onChangePassword} />
      <Divider />
      {!hasRandomPW && (
        <Checkbox
          checked={rememberPassword}
          label="Remember my password"
          onCheck={onChangeRememberPassword}
          style={{paddingTop: Styles.globalMargins.small}}
        />
      )}
    </Box>
  )
}

function Landing(props: Props) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1, padding: Styles.globalMargins.medium}}>
      <Account {...props.account} />
      {flags.plansEnabled && <Plan {...props.plan} plans={props.plans} />}
    </Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  freeSpaceBar: {
    ...Styles.globalStyles.rounded,
    backgroundColor: Styles.globalColors.white,
    height: 4,
    position: 'absolute',
    top: -2,
    width: 64,
  },
  planLevelRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ROW_HEIGHT,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
}))

export default Landing
