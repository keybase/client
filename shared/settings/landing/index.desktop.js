// @flow
import React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Button, Icon, Text, Meta} from '../../common-adapters'
import {plans} from '../../constants/settings'

import type {Props, AccountProps, PlanProps} from './index'
import type {PlanLevel, PaymentInfo as PaymentInfoType} from '../../constants/settings'

const ROW_HEIGHT = 48

type PlanActionVariantsProps = {
  type: 'downgrade',
  onDowngrade: () => void,
} | {
  type: 'upgrade',
  onUpgrade: () => void,
} | {
  type: 'spaceInfo',
  freeSpace: string,
  freeSpacePercentage: number,
  lowSpaceWarning: boolean,
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

function variantPropsHelper (selectedLevel: PlanLevel, otherLevel: PlanLevel, onDowngrade: (l: PlanLevel) => void, onUpgrade: (l: PlanLevel) => void, freeSpace: string, freeSpacePercentage: number, lowSpaceWarning: boolean): PlanActionVariantsProps {
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
        freeSpace,
        freeSpacePercentage,
        lowSpaceWarning,
      }
    case 1:
    default:
      return {
        type: 'upgrade',
        onUpgrade: () => onUpgrade(otherLevel),
      }
  }
}

const Divider = () => <Box style={{height: 1, backgroundColor: globalColors.black_05, flex: 1}} />

function Stars ({level}: {level: PlanLevel}) {
  // TODO(mm) use actual icon here
  return <Text type='BodySmall'>{'*****'.substring(0, levelToStars[level])}</Text>
}

function SpaceInfo ({freeSpace, freeSpacePercentage, lowSpaceWarning}: {freeSpace: string, freeSpacePercentage: number, lowSpaceWarning: boolean}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Text
        style={{marginRight: globalMargins.xtiny}}
        type={'BodySmall'}>
        {freeSpace} FREE
      </Text>
      <Box style={{position: 'relative', width: 64}}>
        <Box style={freeSpaceBarStyle} />
        <Box
          style={{...freeSpaceBarStyle, backgroundColor: lowSpaceWarning ? globalColors.red : globalColors.blue, width: Math.round(64 * freeSpacePercentage)}} />
      </Box>
    </Box>
  )
}

function UpgradeButton ({onUpgrade}: {onUpgrade: () => void}) {
  return (
    <Button style={{marginRight: 0}} type='Follow' label='Upgrade' onClick={onUpgrade} />
  )
}

function DowngradeLink ({onDowngrade}: {onDowngrade: () => void}) {
  return (
    <Text type={'BodySmall'} link={true} style={{color: globalColors.blue}} onClick={onDowngrade}>
      Downgrade
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
      return <SpaceInfo {...variants} />
  }
}

function PlanLevelRow ({level, onInfo, variants, style}: PlanLevelProps) {
  const selected = variants.type === 'spaceInfo'
  return (
    <Box style={{...globalStyles.flexBoxRow, ...planLevelRowStyle, backgroundColor: selected ? globalColors.blue4 : globalColors.white, ...style}}>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Text onClick={() => onInfo()} type={'BodySemibold'} link={true} style={{marginRight: globalMargins.xtiny, color: globalColors.blue}}>
            {level}
          </Text>
          <Text style={{...globalStyles.flex}} type={'BodySmall'}>
            ({levelToPrice[level]})
          </Text>
        </Box>
        {selected && <Meta title='Your Plan' style={{backgroundColor: globalColors.blue2}} />}
      </Box>
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Text style={{...globalStyles.flex, marginRight: globalMargins.xtiny}} type={'BodyXSmall'}>
          {levelToSpace[level]}
        </Text>
        <Stars level={level} />
      </Box>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, justifyContent: 'flex-end'}}>
        <PlanActionVariants variants={variants} />
      </Box>
    </Box>
  )
}

function PaymentInfo ({name, last4Digits, isBroken, onChangePaymentInfo}: PaymentInfoType & {onChangePaymentInfo: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, marginTop: globalMargins.medium}}>
      <Text
        style={{color: globalColors.black_40}}
        type='BodySmall'>
        Your payment method
      </Text>
      <Divider />
      <Box style={{...globalStyles.flexBoxRow, minHeight: ROW_HEIGHT, paddingLeft: globalMargins.xtiny, justifyContent: 'space-between', alignItems: 'center'}}>
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
        <Text type='BodySmall' link={true} style={{color: globalColors.blue}} onClick={onChangePaymentInfo}>
          Update
        </Text>
      </Box>
    </Box>

  )
}

function Plan ({onInfo, onUpgrade, onDowngrade, freeSpace, freeSpacePercentage, selectedLevel, paymentInfo, onChangePaymentInfo, lowSpaceWarning}: PlanProps) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Box style={globalStyles.flexBoxColumn}>
        <Text
          style={{color: globalColors.black_40, marginBottom: globalMargins.tiny}}
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
          variants={variantPropsHelper(selectedLevel, p, onDowngrade, onUpgrade, freeSpace, freeSpacePercentage, lowSpaceWarning)} />))}
      {!!paymentInfo && <PaymentInfo {...paymentInfo} onChangePaymentInfo={onChangePaymentInfo} />}
      {!!paymentInfo &&
        <Text style={{marginTop: globalMargins.small}} type='BodySmall'>
          * You only pay for data you write on Keybase. When you share a file, the recipient does not pay.
        </Text>}
    </Box>
  )
}

function AccountEmail ({email, onChangeEmail, isVerified}: {email: string, isVerified: boolean, onChangeEmail: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, minHeight: ROW_HEIGHT, justifyContent: 'space-between', alignItems: 'center'}}>
      <Box style={globalStyles.flexBoxColumn}>
        <Text type='Body'>{email}</Text>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Icon type={isVerified ? 'iconfont-check' : 'iconfont-close'}
            style={{fontSize: 12, color: isVerified ? globalColors.green2 : globalColors.red}} />
          <Text type='BodySmall' style={{marginLeft: globalMargins.xtiny, color: isVerified ? globalColors.green2 : globalColors.red}}>
            {isVerified ? 'Verified' : 'Not verified'}
          </Text>
        </Box>
      </Box>
      <Text type='BodySmall' style={{color: globalColors.blue}} link={true} onClick={onChangeEmail}>Edit</Text>
    </Box>
  )
}

function AccountPassphrase ({onChangePassphrase}: {onChangePassphrase: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, minHeight: ROW_HEIGHT, alignItems: 'center'}}>
      <Text type='BodySmall' style={{marginRight: globalMargins.xtiny}}>
        Passphrase:
      </Text>
      <Text type='Body' inline={true} style={{flex: 1}}>•••••••••</Text>
      <Text type='BodySmall' style={{color: globalColors.blue}} link={true} onClick={onChangePassphrase}>Edit</Text>
    </Box>
  )
}

function Account ({email, isVerified, onChangeEmail, onChangePassphrase}: AccountProps) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, marginBottom: globalMargins.medium}}>
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
