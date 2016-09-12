// @flow
import React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Button, Icon, Input, Text} from '../../common-adapters'
import {plans} from '../../constants/settings'

import type {Props, AccountProps} from './index'
import type {PlanLevel, PaymentInfo as PaymentInfoType} from '../../constants/settings'

type PlanActionVariantsProps = {
  type: 'downgrade',
  onDowngrade: () => void,
} | {
  type: 'upgrade',
  onUpgrade: () => void,
} | {
  type: 'spaceInfo',
  spaceInfo: {
    freeSpace: string,
    freeSpacePercentage: number,
  }
}

type PlanLevelProps = {
  style?: Object,
  level: PlanLevel,
  onInfo: () => void,
    variants: PlanActionVariantsProps
}

const levelToPrice: {[key: PlanLevel]: string} = {
  'Basic': 'Free',
  'Gold': '$7/mo',
  'Friend': '$9/mo',
}

const levelToStars: {[key: PlanLevel]: number} = {
  'Basic': 1,
  'Gold': 3,
  'Friend': 5,
}

const levelToSpace: {[key: PlanLevel]: string} = {
  'Basic': '10GB',
  'Gold': '50GB',
  'Friend': '250GB',
}

// Compare weather another plan is an upgrade, downgrade or the same
// -1 : otherLevel is a downgrade from level
// 0 : otherLevel is the same as level
// 1 : otherLevel is an upgrade from level
function comparePlans (level: PlanLevel, otherLevel: PlanLevel): -1 | 0 | 1 {
  const levelIndex = plans.indexOf(level)
  const otherLevelIndex = plans.indexOf(otherLevel)
  if (levelIndex === otherLevelIndex) return 0
  if (levelIndex < otherLevelIndex) return 1
  if (levelIndex > otherLevelIndex) return -1

  // make flow happy
  return 0
}

function variantPropsHelper (selectedLevel: PlanLevel, otherLevel: PlanLevel, onDowngrade: (l: PlanLevel) => void, onUpgrade: (l: PlanLevel) => void, freeSpace: string, freeSpacePercentage: number): PlanActionVariantsProps {
  const comparison = comparePlans(selectedLevel, otherLevel)

  switch (comparison) {
    case -1:
      return {
        type: 'downgrade',
        onDowngrade: () => onDowngrade(otherLevel),
      }
    case 0:
      return {
        type: 'spaceInfo',
        spaceInfo: {
          freeSpace,
          freeSpacePercentage,
        },
      }
    case 1:
    default:
      return {
        type: 'upgrade',
        onUpgrade: () => onUpgrade(otherLevel),
      }
  }
}

const Divider = () => <Box style={{height: 1, backgroundColor: globalColors.black_40, flex: 1}} />

function Stars ({level}: {level: PlanLevel}) {
  return null
}

function SpaceInfo ({freeSpace, freeSpacePercentage}: {freeSpace: string, freeSpacePercentage: number}) {
  return (
    <Text type={'BodySmall'}>
      space info
    </Text>
  )
}

function UpgradeButton ({onUpgrade}: {onUpgrade: () => void}) {
  return (
    <Text type={'BodySmall'}>
      upgrade
    </Text>
  )
}

function DowngradeLink ({onDowngrade}: {onDowngrade: () => void}) {
  return (
    <Text type={'BodySmall'}>
      downgrade
    </Text>
  )
}

function PlanActionVariants ({variants}: {variants: PlanActionVariantsProps}) {
  switch (variants.type) {
    case 'downgrade':
      return <DowngradeLink onDowngrade={variants.onDowngrade} />
    case 'upgrade':
      return <UpgradeButton onUpgrade={variants.onUpgrade} />
    case 'spaceInfo':
      return <SpaceInfo {...variants.spaceInfo} />
  }
}

function PlanLevelRow ({level, onInfo, variants, style}: PlanLevelProps) {
  const selected = variants.type === 'spaceInfo'

  return (
    <Box style={{...globalStyles.flexBoxRow, ...planLevelRowStyle, backgroundColor: selected ? globalColors.blue4 : globalColors.white, ...style}}>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Text onClick={() => onInfo()} type={'BodyPrimaryLink'}>
          {level}
        </Text>
        <Text style={{...globalStyles.flex}} type={'BodySmall'}>
          ({levelToPrice[level]})
        </Text>
      </Box>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Text style={{...globalStyles.flex}} type={'BodySmall'}>
          ({levelToSpace[level]})
        </Text>
        <Stars level={level} />
      </Box>
      <Box style={{...globalStyles.flexBoxRow}}>
        <PlanActionVariants variants={variants} />
      </Box>
    </Box>
  )
}

function PaymentInfo ({name, last4Digits, isBroken, onChangePaymentInfo}: PaymentInfoType & {onChangePaymentInfo: () => void}) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Text
        style={{color: globalColors.black_40}}
        type='BodySmall'>
        Your payment method
      </Text>
      <Divider />
      <Box style={{...globalStyles.flexBoxRow, justifyContent: 'space-between', alignItems: 'center'}}>
        <Box style={globalStyles.flexBoxColumn}>
          <Text
            type='Body'>
            {name}
          </Text>
          <Text
            style={{color: isBroken ? globalColors.red : globalColors.black_40}}
            type='BodySmall'>
            **** {last4Digits} {isBroken ? ' (broken)' : ''}
          </Text>
        </Box>
        <Button type='Primary' label='Update' onClick={onChangePaymentInfo} />
      </Box>
    </Box>

  )
}

function Plan ({onInfo, onUpgrade, onDowngrade, freeSpace, freeSpacePercentage, selectedLevel, paymentInfo, onChangePaymentInfo}) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Box style={globalStyles.flexBoxColumn}>
        <Text
          style={{color: globalColors.black_40}}
          type='BodySmall'>
          Your plan
        </Text>
        <Divider />
      </Box>
      {plans.map(p => (
        <PlanLevelRow
          key={p}
          level={p}
          onInfo={() => onInfo(p)}
          variants={variantPropsHelper(selectedLevel, p, onDowngrade, onUpgrade, freeSpace, freeSpacePercentage)} />))}
      {!!paymentInfo && <PaymentInfo {...paymentInfo} onChangePaymentInfo={onChangePaymentInfo} />}
      {!!paymentInfo &&
        <Text type='BodySmall'>
          * You only pay for data you write on Keybase. When you share a file, the recipient does not pay.
        </Text>}
    </Box>
  )
}

function AccountEmail ({email, onChangeEmail, isVerified}: {email: string, isVerified: boolean, onChangeEmail: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, justifyContent: 'space-between', alignItems: 'center'}}>
      <Box style={globalStyles.flexBoxColumn}>
        <Text type='Body'>{email}</Text>
        <Box style={globalStyles.flexBoxRow}>
          <Icon type={isVerified ? 'iconfont-check' : 'iconfont-close'}
            style={{color: isVerified ? globalColors.green2 : globalColors.red}} />
          <Text type='BodySmall' style={{color: isVerified ? globalColors.green2 : globalColors.red}}>
            {email}
          </Text>
        </Box>
      </Box>
      <Text type='BodySmall' style={{color: globalColors.blue}} link={true} onClick={onChangeEmail}>Edit</Text>
    </Box>
  )
}

function AccountPassphrase ({onChangePassphrase}: {onChangePassphrase: () => void}) {
  return (
    <Box style={globalStyles.flexBoxRow}>
      <Text type='BodySmall'>
        Passphrase:
      </Text>
      <Text type='Body' style={{flex: 1}}>•••••••••</Text>
      <Text type='BodySmall' style={{color: globalColors.blue}} link={true} onClick={onChangePassphrase}>Edit</Text>
    </Box>
  )
}

function Account ({email, isVerified, onChangeEmail, onChangePassphrase}: AccountProps) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <AccountEmail email={email} isVerified={isVerified} onChangeEmail={onChangeEmail} />
      <Divider />
      <AccountPassphrase onChangePassphrase={onChangePassphrase} />
    </Box>
  )
}

function Landing (props: Props) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Account {...props.account} />
      <Plan {...props.plan} />
    </Box>
  )
}

const planLevelRowStyle = {
  justifyContent: 'space-between',
}

export default Landing
