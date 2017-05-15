// @flow

import React from 'react'
import {Box} from '../common-adapters'

import UpdateEmail from './email'
import UpdatePassphrase from './passphrase'
import PaymentForm from './payment'
import Landing from './landing'
import SettingsContainer from './render'
import DeleteMe from './delete'
import DeleteConfirm from './delete-confirm'
import Notifications from './notifications'
import {InviteGeneratedRender} from './invite-generated'
import PlanDetails from './plan-details'
import Invites from './invites'
import {landingTab} from '../constants/settings'

import type {DumbComponentMap} from '../constants/types/more'
import type {PendingInvite} from '../settings/invites/index'

const updateEmailBase = {
  email: 'party@mypla.ce',
  isVerified: true,
  edited: false,
  waitingForResponse: false,
  onChangeNewEmail: () => console.log('onChangeNewEmail'),
  onSave: () => console.log('onSave'),
  onBack: () => console.log('onBack'),
}

const updateEmailMap: DumbComponentMap<UpdateEmail> = {
  component: UpdateEmail,
  mocks: {
    Normal: updateEmailBase,
    'Normal - No Email': {
      ...updateEmailBase,
      isVerified: false,
      email: null,
    },
    'Not Verified - No Email': {
      ...updateEmailBase,
      isVerified: false,
    },
    'Resend Confirmation': {
      ...updateEmailBase,
      onResendConfirmationCode: () => console.log('onResendConfirmationCode'),
    },
  },
}

const updatePassphraseBase = {
  onChangeNewPassphrase: newPassphrase =>
    console.log('onChangeNewPassphrase', newPassphrase),
  onChangeNewPassphraseConfirm: newPassphraseConfirm =>
    console.log('onChangeNewPassphraseConfirm', newPassphraseConfirm),
  onChangeShowPassphrase: showPassphrase =>
    console.log('onChangeShowPassphrase', showPassphrase),
  newPassphrase: 'open sesame',
  newPassphraseConfirm: 'open sesame',
  hasPGPKeyOnServer: false,
  showTyping: false,
  errorMessage: null,
  newPassphraseError: null,
  newPassphraseConfirmError: null,
  canSave: true,
  waitingForResponse: false,
  onBack: () => console.log('onBack'),
  onSave: () => console.log('onSave'),
  onUpdatePGPSettings: () => console.log('onUpdatePGPSettings'),
}

const updatePassphraseMap: DumbComponentMap<UpdatePassphrase> = {
  component: UpdatePassphrase,
  mocks: {
    'Normal - Empty': {
      ...updatePassphraseBase,
      newPassphrase: '',
      newPassphraseConfirm: '',
      canSave: false,
    },
    'Normal - Has PGP on server': {
      ...updatePassphraseBase,
      newPassphrase: '',
      newPassphraseConfirm: '',
      hasPGPKeyOnServer: true,
      canSave: false,
    },
    Normal: updatePassphraseBase,
    'Normal - Show Typing': {
      ...updatePassphraseBase,
      showTyping: true,
    },
    'Error - Wrong Passphrase': {
      ...updatePassphraseBase,
      errorMessage: 'Wrong current passphrase. Please try again.',
      currentPassphrase: '',
      canSave: false,
    },
    'Error - New Passphrase Requirements': {
      ...updatePassphraseBase,
      newPassphraseError: 'Your new passphrase must have minimum 12 characters.',
      newPassphraseConfirm: '',
    },
    'Error - New Passphrase Mismatch': {
      ...updatePassphraseBase,
      newPassphraseConfirmError: 'Passphrase confirmation does not match.',
    },
  },
}

const paymentBase = {
  onChangeCardNumber: () => console.log('onChangeCardNumber'),
  onChangeName: () => console.log('onChangeName'),
  onChangeExpiration: () => console.log('onChangeExpiration'),
  onChangeSecurityCode: () => console.log('onChangeSecurityCode'),
  cardNumber: '0001 0002 0003 4242',
  name: 'Jessica Jones',
  expiration: '01/2017',
  securityCode: '123',
  onBack: () => console.log('onBack'),
  onSubmit: () => console.log('onSubmit'),
}

const paymentFormMap: DumbComponentMap<PaymentForm> = {
  component: PaymentForm,
  mocks: {
    'Normal - Empty': {
      ...paymentBase,
      cardNumber: '',
      name: '',
      expiration: '',
      securityCode: '',
    },
    Normal: paymentBase,
    'Normal - Error': {
      ...paymentBase,
      errorMessage: 'Please check your payment details.',
    },
  },
}

const accountBase = {
  email: 'party@mypla.ce',
  isVerified: true,
  onChangeEmail: () => console.log('onChangeEmail'),
  onChangePassphrase: () => console.log('onChangePassphrase'),
}

const planInfoBasic = {
  planLevel: 'Basic',
  planId: 'Basic',
  gigabytes: 10,
  price_pennies: 0,
}

const planInfoGold = {
  planLevel: 'Gold',
  planId: 'Gold',
  gigabytes: 50,
  price_pennies: 700,
}

const planInfoFriend = {
  planLevel: 'Friend',
  planId: 'Friend',
  gigabytes: 250,
  price_pennies: 900,
}

const planBase = {
  onUpgrade: l => console.log('onUpgrade to', l),
  onDowngrade: l => console.log('onDowngrade to', l),
  onInfo: l => console.log('onInfo for', l),
  selectedLevel: 'Basic',
  freeSpace: '5GB',
  freeSpacePercentage: 0.5,
  lowSpaceWarning: false,
  onChangePaymentInfo: () => console.log('onChangePaymentInfo'),
  paymentInfo: null,
}

const landingBase = {
  plan: planBase,
  account: accountBase,
  plans: [planInfoBasic, planInfoGold, planInfoFriend],
}

const goldBase = {
  ...landingBase,
  plan: {
    ...planBase,
    selectedLevel: 'Gold',
    lowSpaceWarning: true,
    freeSpacePercentage: 0.9,
    paymentInfo: {
      name: 'Jessica Jones',
      last4Digits: '1337',
      isBroken: false,
    },
  },
}

const landingMap: DumbComponentMap<Landing> = {
  component: Landing,
  mocks: {
    Normal: landingBase,
    'Normal - Not Verified email': {
      ...landingBase,
      account: {...landingBase.account, isVerified: false},
    },
    'Gold Plan': goldBase,
    'Gold Plan - Broken Payment': {
      ...goldBase,
      plan: {
        ...goldBase.plan,
        paymentInfo: {
          ...goldBase.plan.paymentInfo,
          isBroken: true,
        },
      },
    },
  },
}

const fillerContent = <Box style={{flex: 1, backgroundColor: 'grey'}} />

const settingsNavBase = {
  badgeNumbers: {
    [landingTab]: 1,
  },
  children: fillerContent,
  selectedTab: landingTab,
  onTabChange: tab => {
    console.log('onTabChange', tab)
  },
  onLogout: () => {},
  showComingSoon: false,
}

const settingsContainerMap: DumbComponentMap<SettingsContainer> = {
  component: SettingsContainer,
  mocks: {
    Normal: settingsNavBase,
  },
}

const deleteMeMap: DumbComponentMap<DeleteMe> = {
  component: DeleteMe,
  mocks: {
    Normal: {
      onDelete: () => console.log('onDelete clicked'),
      onRevokeCurrentDevice: () => console.log('onRevokeCurrentDevice clicked'),
      parentProps: {
        style: {
          height: 500,
          display: 'flex',
        },
      },
    },
  },
}

const deleteConfirmMap: DumbComponentMap<DeleteConfirm> = {
  component: DeleteConfirm,
  mocks: {
    Normal: {
      onDeleteForever: () => console.log('onDeleteForever clicked'),
      onCancel: () => console.log('onCancel clicked'),
      username: 'chris',
      allowDeleteForever: true,
      setAllowDeleteAccount: allow =>
        console.log('setAllowDeleteAccount', allow),
      parentProps: {
        style: {
          height: 500,
          display: 'flex',
        },
      },
    },
  },
}

const commonSettings = {
  settings: [
    {
      name: 'follow',
      subscribed: true,
      description: 'when someone follows me',
    },
    {
      name: 'twitter_friend_joined',
      subscribed: true,
      description: 'when someone I follow on Twitter joins',
    },
    {
      name: 'filesystem_attention',
      subscribed: true,
      description: 'when the Keybase filesystem needs my attention',
    },
    {
      name: 'newsletter',
      subscribed: true,
      description: 'Keybase news, once in a great while',
    },
  ],
  unsubscribedFromAll: false,
  allowSave: true,
  allowEdit: true,
  waitingForResponse: false,
  onRefresh: () => console.log('onRefresh'),
  onSave: () => console.log('onSave'),
  onToggle: (name: string) => console.log('on toggle', name),
  onToggleUnsubscribeAll: () => console.log('on subscribe all'),
}

const notificationsMap: DumbComponentMap<Notifications> = {
  component: Notifications,
  mocks: {
    Normal: {
      ...commonSettings,
    },
    UnsubAll: {
      ...commonSettings,
      unsubscribedFromAll: true,
    },
  },
}

const commonInvite = {
  link: 'keybase.io/inv/9999999999',
  email: '',
  parentProps: {
    style: {
      height: 500,
      display: 'flex',
    },
  },
  onClose: () => console.log('onClose clicked'),
}

const inviteGeneratedMap: DumbComponentMap<InviteGeneratedRender> = {
  component: InviteGeneratedRender,
  mocks: {
    Normal: {
      ...commonInvite,
      email: 'user@gmail.com',
    },
    'No email': {
      ...commonInvite,
    },
  },
}

const creditCardNoPast = {
  type: 'credit-card-no-past',
  onAddCreditCard: () => {
    console.log('onAddCreditCard')
  },
}

const creditCardWithPast = {
  type: 'credit-card-with-past',
  cardInfo: 'Visa **** 4242',
  onPayWithSavedCard: () => {
    console.log('onPayWithSavedCard')
  },
  onUpdateCard: () => {
    console.log('onPayWithSavedCard')
  },
}

const applePay = {
  type: 'apple-pay',
  onPayWithCardInstead: () => {
    console.log('onPayWithCardInstead')
  },
}

const planDetailsMap: DumbComponentMap<PlanDetails> = {
  component: PlanDetails,
  mocks: {
    'Credit Card No Past': {
      plan: 'Basic',
      paymentOption: creditCardNoPast,
      gigabytes: 10,
      numStars: 1,
      price: 'Free',
      onBack: () => {},
    },
    'Credit Card With Past': {
      plan: 'Gold',
      paymentOption: creditCardWithPast,
      gigabytes: 50,
      numStars: 3,
      price: '$7/month',
      onBack: () => {},
    },
    'Apple Pay': {
      plan: 'Friend',
      paymentOption: applePay,
      gigabytes: 250,
      numStars: 5,
      price: '$9/month',
      onBack: () => {},
    },
  },
}

const invitesBase = {
  inviteEmail: 'tcook@apple.com',
  inviteMessage: 'Hey Tim! I heard you like end-to-end encryption...',
  showMessageField: true,
  pendingInvites: [
    {
      id: '123456',
      created: 1469565223,
      url: 'keybase.io/inv/9999999999',
      email: 'tcook@apple.com',
    },
    {
      id: '123457',
      created: 1469566223,
      url: 'keybase.io/inv/9999999999',
      email: '',
    },
  ],
  acceptedInvites: [
    {
      id: '223456',
      created: 1469565223,
      uid: 1,
      username: 'chris',
      fullname: 'Chris Coyne',
      currentlyFollowing: false,
      trackerState: 'normal',
    },
    {
      id: '223457',
      created: 1469566223,
      uid: 2,
      username: 'cecileb',
      fullname: 'Cécile Boucheron',
      currentlyFollowing: true,
      trackerState: 'normal',
    },
    {
      id: '223458',
      created: 1469567223,
      uid: 3,
      username: 'chromakode',
      fullname: 'Max Goodman',
      currentlyFollowing: false,
      trackerState: 'error',
    },
  ],
  onSelectUser: username => console.log('onSelectUser', username),
  onReclaimInvitation: invitationId =>
    console.log('onReclaimInvitation', invitationId),
  onGenerateInvitation: () => console.log('onGenerateInvitation'),
  onSelectPendingInvite: (invite: PendingInvite) =>
    console.log('onSelectPendingInvite'),
  onClearError: () => {},
  waitingForResponse: false,
  parentProps: {
    style: {
      width: 504,
    },
  },
  onRefresh: () => console.log('onRefresh'),
  error: null,
}

const invitesMap: DumbComponentMap<Invites> = {
  component: Invites,
  mocks: {
    'Normal - Empty': {
      ...invitesBase,
      inviteEmail: '',
      inviteMessage: '',
      showMessageField: false,
      pendingInvites: [],
      acceptedInvites: [],
    },
    'Normal - Empty Message': {
      ...invitesBase,
      inviteMessage: '',
    },
    Normal: invitesBase,
    'Normal - Email Error': {
      ...invitesBase,
      error: new Error('Oops, you entered an invalid email address'),
    },
  },
}

export default {
  UpdateEmail: updateEmailMap,
  UpdatePassphrase: updatePassphraseMap,
  PaymentForm: paymentFormMap,
  Landing: landingMap,
  SettingsNav: settingsContainerMap,
  DeleteMe: deleteMeMap,
  DeleteConfirm: deleteConfirmMap,
  Notifications: notificationsMap,
  InviteGenerated: inviteGeneratedMap,
  PlanDetails: planDetailsMap,
  Invites: invitesMap,
}
