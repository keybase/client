// @flow
import React from 'react'
import SubHeading from '../subheading'
import {Box, Button, Divider, Icon, Text, Meta} from '../../common-adapters'
import {Stars} from '../common.desktop.js'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {priceToString, planToStars, comparePlans} from '../../constants/plan-billing'
import flags from '../../util/feature-flags'

import type {Props, AccountProps, PlanProps} from './index'
import type {PlanLevel} from '../../constants/settings'
import type {PaymentInfo as PaymentInfoType, AvailablePlan, ChangeType} from '../../constants/plan-billing'

const ROW_HEIGHT = 48

type PlanActionVariantsProps =
  | {
      type: 'change',
      changeType: ChangeType,
    }
  | {
      type: 'spaceInfo',
      freeSpace: string,
      freeSpacePercentage: number,
      lowSpaceWarning: boolean,
    }

type PlanLevelProps = {
  style?: Object,
  level: PlanLevel,
  price: string,
  gigabytes: number,
  onInfo: () => void,
  variants: PlanActionVariantsProps,
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
      type: 'spaceInfo',
      freeSpace,
      freeSpacePercentage,
      lowSpaceWarning,
    }
  }

  return {
    type: 'change',
    changeType: changeType,
  }
}

function SpaceInfo({
  freeSpace,
  freeSpacePercentage,
  lowSpaceWarning,
}: {
  freeSpace: string,
  freeSpacePercentage: number,
  lowSpaceWarning: boolean,
}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Text
        style={{marginRight: globalMargins.xtiny, fontSize: 11, color: globalColors.black_40}}
        type={'BodySmallSemibold'}
      >
        {freeSpace} FREE
      </Text>
      <Box style={{position: 'relative', width: 64}}>
        <Box style={freeSpaceBarStyle} />
        <Box
          style={{
            ...freeSpaceBarStyle,
            backgroundColor: lowSpaceWarning ? globalColors.red : globalColors.blue,
            width: Math.round(64 * freeSpacePercentage),
          }}
        />
      </Box>
    </Box>
  )
}

const UpgradeButton = ({onClick, type}: {onClick: () => void, type: 'upgrade' | 'change'}) =>
  <Button
    style={{marginRight: 0}}
    type="Follow"
    label={{upgrade: 'Upgrade', change: 'Change'}[type]}
    onClick={e => {
      onClick()
      e.stopPropagation()
    }}
  />

const DowngradeLink = ({onClick}) =>
  <Text
    type={'BodySmall'}
    link={true}
    style={{color: globalColors.blue}}
    onClick={e => {
      onClick()
      e.stopPropagation()
    }}
  >
    Downgrade
  </Text>

function PlanActionVariants({variants, onClick}: {variants: PlanActionVariantsProps, onClick: () => void}) {
  switch (variants.type) {
    case 'change':
      return variants.changeType === 'downgrade'
        ? <DowngradeLink onClick={onClick} />
        : <UpgradeButton onClick={onClick} type={variants.changeType} />
    case 'spaceInfo':
      return <SpaceInfo {...variants} />
  }
}

function PlanLevelRow({level, price, onInfo, variants, style, gigabytes}: PlanLevelProps) {
  const selected = variants.type === 'spaceInfo'
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        ...globalStyles.clickable,
        ...planLevelRowStyle,
        backgroundColor: selected ? globalColors.blue4 : globalColors.white,
        ...style,
      }}
      onClick={() => onInfo()}
    >
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Text
            type={'BodySemibold'}
            link={true}
            style={{marginRight: globalMargins.xtiny, color: globalColors.blue}}
          >
            {level}
          </Text>
          <Text type={'BodySmall'}>
            ({price})
          </Text>
        </Box>
        {selected && <Meta title="Your Plan" style={{backgroundColor: globalColors.blue2}} />}
      </Box>
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Text style={{...globalStyles.fontSemibold, marginRight: globalMargins.xtiny}} type="BodySmall">
          {`${gigabytes}GB`}
        </Text>
        <Stars count={planToStars(level)} />
      </Box>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'flex-end'}}>
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
}: PaymentInfoType & {onChangePaymentInfo: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, marginTop: globalMargins.medium}}>
      <SubHeading>Your payment method</SubHeading>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          minHeight: ROW_HEIGHT,
          paddingLeft: globalMargins.xtiny,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box style={globalStyles.flexBoxColumn}>
          <Text type="Body">
            {name}
          </Text>
          <Text style={{color: isBroken ? globalColors.red : globalColors.black_40}} type="BodySmall">
            **** {last4Digits} {isBroken ? ' (broken)' : ''}
          </Text>
        </Box>
        <Text type="BodySmall" link={true} style={{color: globalColors.blue}} onClick={onChangePaymentInfo}>
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
}: PlanProps & {plans: Array<AvailablePlan>}) {
  const from: ?AvailablePlan = plans.find((plan: AvailablePlan) => plan.planLevel === selectedLevel)
  if (!from) {
    throw new Error("Can't find existing plan")
  }

  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Box style={globalStyles.flexBoxColumn}>
        <SubHeading>Your plan</SubHeading>
      </Box>
      {plans.map(p =>
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
      )}
      {!!paymentInfo && <PaymentInfo {...paymentInfo} onChangePaymentInfo={onChangePaymentInfo} />}
      {!!paymentInfo &&
        <Text style={{marginTop: globalMargins.small}} type="BodySmall">
          * You only pay for data you write on Keybase. When you share a file, the recipient does not pay.
        </Text>}
    </Box>
  )
}

function AccountEmail({
  email,
  onChangeEmail,
  isVerified,
}: {
  email: string,
  isVerified: boolean,
  onChangeEmail: () => void,
}) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        minHeight: ROW_HEIGHT,
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="BodySemibold">
          {email}
        </Text>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Icon
            type={isVerified ? 'iconfont-check' : 'iconfont-close'}
            style={{fontSize: 10, color: isVerified ? globalColors.green2 : globalColors.red}}
          />
          <Text
            type="BodySmall"
            style={{
              marginLeft: globalMargins.xtiny,
              color: isVerified ? globalColors.green2 : globalColors.red,
            }}
          >
            {isVerified ? 'Verified' : 'Not verified'}
          </Text>
        </Box>
      </Box>
      <Text type="Body" style={{color: globalColors.blue}} link={true} onClick={onChangeEmail}>
        Edit
      </Text>
    </Box>
  )
}

function AccountPassphrase({onChangePassphrase}: {onChangePassphrase: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, minHeight: ROW_HEIGHT, alignItems: 'center'}}>
      <Text type="Body" style={{marginRight: globalMargins.xtiny}}>
        Passphrase:
      </Text>
      <Text type="Body" style={{flex: 1}}>
        •••••••••
      </Text>
      <Text type="Body" style={{color: globalColors.blue}} link={true} onClick={onChangePassphrase}>
        Edit
      </Text>
    </Box>
  )
}

function Account({email, isVerified, onChangeEmail, onChangePassphrase}: AccountProps) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, marginBottom: globalMargins.medium}}>
      <AccountEmail email={email} isVerified={isVerified} onChangeEmail={onChangeEmail} />
      <Divider style={{backgroundColor: globalColors.black_05}} />
      <AccountPassphrase onChangePassphrase={onChangePassphrase} />
    </Box>
  )
}

function Landing(props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, padding: globalMargins.medium}}>
      <Account {...props.account} />
      {flags.plansEnabled && <Plan {...props.plan} plans={props.plans} />}
    </Box>
  )
}

const planLevelRowStyle = {
  justifyContent: 'space-between',
  minHeight: ROW_HEIGHT,
  alignItems: 'center',
  paddingRight: globalMargins.tiny,
  paddingLeft: globalMargins.tiny,
}

const freeSpaceBarStyle = {
  ...globalStyles.rounded,
  position: 'absolute',
  height: 4,
  top: -2,
  width: 64,
  backgroundColor: globalColors.white,
}

export default Landing
