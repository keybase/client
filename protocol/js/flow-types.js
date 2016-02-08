/* @flow */

export type int = number
export type long = number
export type double = number
export type bytes = any

export type incomingCallMapType = {
  'keybase.1.account.passphraseChange'?: (
    params: {
      sessionID: int,
      oldPassphrase: string,
      passphrase: string,
      force: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.account.passphrasePrompt'?: (
    params: {
      sessionID: int,
      guiArg: account_GUIEntryArg
    },
    response: {
      error: (err: string) => void,
      result: (result: account_passphrasePrompt_result) => void
    }
  ) => void,
  'keybase.1.block.getSessionChallenge'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: (result: block_getSessionChallenge_result) => void
    }
  ) => void,
  'keybase.1.block.authenticateSession'?: (
    params: {
      signature: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.putBlock'?: (
    params: {
      bid: block_BlockIdCombo,
      folder: string,
      blockKey: string,
      buf: bytes
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.getBlock'?: (
    params: {
      bid: block_BlockIdCombo,
      folder: string
    },
    response: {
      error: (err: string) => void,
      result: (result: block_getBlock_result) => void
    }
  ) => void,
  'keybase.1.block.addReference'?: (
    params: {
      folder: string,
      ref: block_BlockReference
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.delReference'?: (
    params: {
      folder: string,
      ref: block_BlockReference
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.block.archiveReference'?: (
    params: {
      folder: string,
      refs: Array<block_BlockReference>
    },
    response: {
      error: (err: string) => void,
      result: (result: block_archiveReference_result) => void
    }
  ) => void,
  'keybase.1.block.getUserQuotaInfo'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: (result: block_getUserQuotaInfo_result) => void
    }
  ) => void,
  'keybase.1.BTC.registerBTC'?: (
    params: {
      sessionID: int,
      address: string,
      force: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.getCurrentStatus'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: config_getCurrentStatus_result) => void
    }
  ) => void,
  'keybase.1.config.getExtendedStatus'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: config_getExtendedStatus_result) => void
    }
  ) => void,
  'keybase.1.config.getConfig'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: config_getConfig_result) => void
    }
  ) => void,
  'keybase.1.config.setUserConfig'?: (
    params: {
      sessionID: int,
      username: string,
      key: string,
      value: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.setPath'?: (
    params: {
      sessionID: int,
      path: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.config.helloIAm'?: (
    params: {
      details: config_ClientDetails
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.crypto.signED25519'?: (
    params: {
      sessionID: int,
      msg: bytes,
      reason: string
    },
    response: {
      error: (err: string) => void,
      result: (result: crypto_signED25519_result) => void
    }
  ) => void,
  'keybase.1.crypto.signToString'?: (
    params: {
      sessionID: int,
      msg: bytes,
      reason: string
    },
    response: {
      error: (err: string) => void,
      result: (result: crypto_signToString_result) => void
    }
  ) => void,
  'keybase.1.crypto.unboxBytes32'?: (
    params: {
      sessionID: int,
      encryptedBytes32: crypto_EncryptedBytes32,
      nonce: crypto_BoxNonce,
      peersPublicKey: crypto_BoxPublicKey,
      reason: string
    },
    response: {
      error: (err: string) => void,
      result: (result: crypto_unboxBytes32_result) => void
    }
  ) => void,
  'keybase.1.crypto.unboxBytes32Any'?: (
    params: {
      sessionID: int,
      bundles: Array<crypto_CiphertextBundle>,
      reason: string,
      promptPaper: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: crypto_unboxBytes32Any_result) => void
    }
  ) => void,
  'keybase.1.ctl.stop'?: (
    params: {
      sessionID: int,
      exitCode: ctl_ExitCode
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ctl.logRotate'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ctl.reload'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ctl.dbNuke'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.debugging.firstStep'?: (
    params: {
      sessionID: int,
      val: int
    },
    response: {
      error: (err: string) => void,
      result: (result: debugging_firstStep_result) => void
    }
  ) => void,
  'keybase.1.debugging.secondStep'?: (
    params: {
      sessionID: int,
      val: int
    },
    response: {
      error: (err: string) => void,
      result: (result: debugging_secondStep_result) => void
    }
  ) => void,
  'keybase.1.debugging.increment'?: (
    params: {
      sessionID: int,
      val: int
    },
    response: {
      error: (err: string) => void,
      result: (result: debugging_increment_result) => void
    }
  ) => void,
  'keybase.1.delegateUiCtl.registerIdentifyUI'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.delegateUiCtl.registerSecretUI'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.delegateUiCtl.registerUpdateUI'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.device.deviceList'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: device_deviceList_result) => void
    }
  ) => void,
  'keybase.1.device.deviceAdd'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.favorite.favoriteAdd'?: (
    params: {
      sessionID: int,
      folder: favorite_Folder
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.favorite.favoriteDelete'?: (
    params: {
      sessionID: int,
      folder: favorite_Folder
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.favorite.favoriteList'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: favorite_favoriteList_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.wantToAddGPGKey'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: gpgUi_wantToAddGPGKey_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.confirmDuplicateKeyChosen'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: gpgUi_confirmDuplicateKeyChosen_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.selectKeyAndPushOption'?: (
    params: {
      sessionID: int,
      keys: Array<gpgUi_GPGKey>
    },
    response: {
      error: (err: string) => void,
      result: (result: gpgUi_selectKeyAndPushOption_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.selectKey'?: (
    params: {
      sessionID: int,
      keys: Array<gpgUi_GPGKey>
    },
    response: {
      error: (err: string) => void,
      result: (result: gpgUi_selectKey_result) => void
    }
  ) => void,
  'keybase.1.gpgUi.sign'?: (
    params: {
      msg: bytes,
      fingerprint: bytes
    },
    response: {
      error: (err: string) => void,
      result: (result: gpgUi_sign_result) => void
    }
  ) => void,
  'keybase.1.identify.Resolve'?: (
    params: {
      assertion: string
    },
    response: {
      error: (err: string) => void,
      result: (result: identify_Resolve_result) => void
    }
  ) => void,
  'keybase.1.identify.Resolve2'?: (
    params: {
      assertion: string
    },
    response: {
      error: (err: string) => void,
      result: (result: identify_Resolve2_result) => void
    }
  ) => void,
  'keybase.1.identify.identify'?: (
    params: {
      sessionID: int,
      userAssertion: string,
      trackStatement: boolean,
      forceRemoteCheck: boolean,
      useDelegateUI: boolean,
      reason: identify_IdentifyReason,
      source: identify_ClientType
    },
    response: {
      error: (err: string) => void,
      result: (result: identify_identify_result) => void
    }
  ) => void,
  'keybase.1.identify.identify2'?: (
    params: {
      sessionID: int,
      uid: identify_UID,
      userAssertion: string,
      reason: identify_IdentifyReason,
      useDelegateUI: boolean,
      alwaysBlock: boolean,
      noErrorOnTrackFailure: boolean,
      forceRemoteCheck: boolean,
      needProofSet: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: identify_identify2_result) => void
    }
  ) => void,
  'keybase.1.identifyUi.delegateIdentifyUI'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: (result: identifyUi_delegateIdentifyUI_result) => void
    }
  ) => void,
  'keybase.1.identifyUi.start'?: (
    params: {
      sessionID: int,
      username: string,
      reason: identifyUi_IdentifyReason
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayKey'?: (
    params: {
      sessionID: int,
      key: identifyUi_IdentifyKey
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.reportLastTrack'?: (
    params: {
      sessionID: int,
      track: (null | TrackSummary)
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.launchNetworkChecks'?: (
    params: {
      sessionID: int,
      identity: identifyUi_Identity,
      user: identifyUi_User
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayTrackStatement'?: (
    params: {
      sessionID: int,
      stmt: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.finishWebProofCheck'?: (
    params: {
      sessionID: int,
      rp: identifyUi_RemoteProof,
      lcr: identifyUi_LinkCheckResult
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.finishSocialProofCheck'?: (
    params: {
      sessionID: int,
      rp: identifyUi_RemoteProof,
      lcr: identifyUi_LinkCheckResult
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayCryptocurrency'?: (
    params: {
      sessionID: int,
      c: identifyUi_Cryptocurrency
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.reportTrackToken'?: (
    params: {
      sessionID: int,
      trackToken: identifyUi_TrackToken
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.displayUserCard'?: (
    params: {
      sessionID: int,
      card: identifyUi_UserCard
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.identifyUi.confirm'?: (
    params: {
      sessionID: int,
      outcome: identifyUi_IdentifyOutcome
    },
    response: {
      error: (err: string) => void,
      result: (result: identifyUi_confirm_result) => void
    }
  ) => void,
  'keybase.1.identifyUi.finish'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.kbfs.FSEvent'?: (
    params: {
      event: kbfs_FSNotification
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.Kex2Provisionee.hello'?: (
    params: {
      uid: Kex2Provisionee_UID,
      token: Kex2Provisionee_SessionToken,
      csrf: Kex2Provisionee_CsrfToken,
      pps: Kex2Provisionee_PassphraseStream,
      sigBody: string
    },
    response: {
      error: (err: string) => void,
      result: (result: Kex2Provisionee_hello_result) => void
    }
  ) => void,
  'keybase.1.Kex2Provisionee.didCounterSign'?: (
    params: {
      sig: bytes
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.Kex2Provisioner.kexStart'?: (
    params: {} /* Notify call, No response */
  ) => void,
  'keybase.1.log.registerLogger'?: (
    params: {
      sessionID: int,
      name: string,
      level: log_LogLevel
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.logUi.log'?: (
    params: {
      sessionID: int,
      level: logUi_LogLevel,
      text: logUi_Text
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.getConfiguredAccounts'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: login_getConfiguredAccounts_result) => void
    }
  ) => void,
  'keybase.1.login.login'?: (
    params: {
      sessionID: int,
      deviceType: string,
      username: string,
      clientType: login_ClientType
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.clearStoredSecret'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.logout'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.deprovision'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.recoverAccountFromEmailAddress'?: (
    params: {
      email: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.paperKey'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.unlock'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.login.unlockWithPassphrase'?: (
    params: {
      sessionID: int,
      passphrase: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.loginUi.getEmailOrUsername'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: loginUi_getEmailOrUsername_result) => void
    }
  ) => void,
  'keybase.1.loginUi.promptRevokePaperKeys'?: (
    params: {
      sessionID: int,
      device: loginUi_Device,
      index: int
    },
    response: {
      error: (err: string) => void,
      result: (result: loginUi_promptRevokePaperKeys_result) => void
    }
  ) => void,
  'keybase.1.loginUi.displayPaperKeyPhrase'?: (
    params: {
      sessionID: int,
      phrase: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.loginUi.displayPrimaryPaperKey'?: (
    params: {
      sessionID: int,
      phrase: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getChallenge'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: (result: metadata_getChallenge_result) => void
    }
  ) => void,
  'keybase.1.metadata.authenticate'?: (
    params: {
      signature: string
    },
    response: {
      error: (err: string) => void,
      result: (result: metadata_authenticate_result) => void
    }
  ) => void,
  'keybase.1.metadata.putMetadata'?: (
    params: {
      mdBlock: metadata_MDBlock,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getMetadata'?: (
    params: {
      folderID: string,
      folderHandle: bytes,
      branchID: string,
      unmerged: boolean,
      startRevision: long,
      stopRevision: long,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: (result: metadata_getMetadata_result) => void
    }
  ) => void,
  'keybase.1.metadata.registerForUpdates'?: (
    params: {
      folderID: string,
      currRevision: long,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.pruneBranch'?: (
    params: {
      folderID: string,
      branchID: string,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.putKeys'?: (
    params: {
      keyHalves: Array<metadata_KeyHalf>,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.getKey'?: (
    params: {
      keyHalfID: bytes,
      deviceKID: string,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: (result: metadata_getKey_result) => void
    }
  ) => void,
  'keybase.1.metadata.deleteKey'?: (
    params: {
      uid: metadata_UID,
      deviceKID: metadata_KID,
      keyHalfID: bytes,
      logTags: {string: string}
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.truncateLock'?: (
    params: {
      folderID: string
    },
    response: {
      error: (err: string) => void,
      result: (result: metadata_truncateLock_result) => void
    }
  ) => void,
  'keybase.1.metadata.truncateUnlock'?: (
    params: {
      folderID: string
    },
    response: {
      error: (err: string) => void,
      result: (result: metadata_truncateUnlock_result) => void
    }
  ) => void,
  'keybase.1.metadata.getFolderHandle'?: (
    params: {
      folderID: string,
      signature: string,
      challenge: string
    },
    response: {
      error: (err: string) => void,
      result: (result: metadata_getFolderHandle_result) => void
    }
  ) => void,
  'keybase.1.metadata.getFoldersForRekey'?: (
    params: {
      deviceKID: metadata_KID
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadata.ping'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadataUpdate.metadataUpdate'?: (
    params: {
      folderID: string,
      revision: long
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.metadataUpdate.folderNeedsRekey'?: (
    params: {
      folderID: string,
      revision: long
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.notifyCtl.setNotifications'?: (
    params: {
      channels: notifyCtl_NotificationChannels
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.NotifyFS.FSActivity'?: (
    params: {
      notification: NotifyFS_FSNotification
    } /* Notify call, No response */
  ) => void,
  'keybase.1.NotifySession.loggedOut'?: (
    params: {} /* Notify call, No response */
  ) => void,
  'keybase.1.NotifySession.loggedIn'?: (
    params: {
      username: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.NotifyTracking.trackingChanged'?: (
    params: {
      uid: NotifyTracking_UID,
      username: string
    } /* Notify call, No response */
  ) => void,
  'keybase.1.NotifyUsers.userChanged'?: (
    params: {
      uid: NotifyUsers_UID
    } /* Notify call, No response */
  ) => void,
  'keybase.1.pgp.pgpSign'?: (
    params: {
      sessionID: int,
      source: pgp_Stream,
      sink: pgp_Stream,
      opts: pgp_PGPSignOptions
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpPull'?: (
    params: {
      sessionID: int,
      userAsserts: Array<string>
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpEncrypt'?: (
    params: {
      sessionID: int,
      source: pgp_Stream,
      sink: pgp_Stream,
      opts: pgp_PGPEncryptOptions
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpDecrypt'?: (
    params: {
      sessionID: int,
      source: pgp_Stream,
      sink: pgp_Stream,
      opts: pgp_PGPDecryptOptions
    },
    response: {
      error: (err: string) => void,
      result: (result: pgp_pgpDecrypt_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpVerify'?: (
    params: {
      sessionID: int,
      source: pgp_Stream,
      opts: pgp_PGPVerifyOptions
    },
    response: {
      error: (err: string) => void,
      result: (result: pgp_pgpVerify_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpImport'?: (
    params: {
      sessionID: int,
      key: bytes,
      pushSecret: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpExport'?: (
    params: {
      sessionID: int,
      options: pgp_PGPQuery
    },
    response: {
      error: (err: string) => void,
      result: (result: pgp_pgpExport_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpExportByFingerprint'?: (
    params: {
      sessionID: int,
      options: pgp_PGPQuery
    },
    response: {
      error: (err: string) => void,
      result: (result: pgp_pgpExportByFingerprint_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpExportByKID'?: (
    params: {
      sessionID: int,
      options: pgp_PGPQuery
    },
    response: {
      error: (err: string) => void,
      result: (result: pgp_pgpExportByKID_result) => void
    }
  ) => void,
  'keybase.1.pgp.pgpKeyGen'?: (
    params: {
      sessionID: int,
      primaryBits: int,
      subkeyBits: int,
      createUids: pgp_PGPCreateUids,
      allowMulti: boolean,
      doExport: boolean,
      pushSecret: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpDeletePrimary'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpSelect'?: (
    params: {
      sessionID: int,
      fingerprintQuery: string,
      allowMulti: boolean,
      skipImport: boolean,
      onlyImport: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgp.pgpUpdate'?: (
    params: {
      sessionID: int,
      all: boolean,
      fingerprints: Array<string>
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.pgpUi.outputSignatureSuccess'?: (
    params: {
      sessionID: int,
      fingerprint: string,
      username: string,
      signedAt: pgpUi_Time
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.prove.startProof'?: (
    params: {
      sessionID: int,
      service: string,
      username: string,
      force: boolean,
      promptPosted: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: prove_startProof_result) => void
    }
  ) => void,
  'keybase.1.prove.checkProof'?: (
    params: {
      sessionID: int,
      sigID: prove_SigID
    },
    response: {
      error: (err: string) => void,
      result: (result: prove_checkProof_result) => void
    }
  ) => void,
  'keybase.1.proveUi.promptOverwrite'?: (
    params: {
      sessionID: int,
      account: string,
      typ: proveUi_PromptOverwriteType
    },
    response: {
      error: (err: string) => void,
      result: (result: proveUi_promptOverwrite_result) => void
    }
  ) => void,
  'keybase.1.proveUi.promptUsername'?: (
    params: {
      sessionID: int,
      prompt: string,
      prevError: (null | Status)
    },
    response: {
      error: (err: string) => void,
      result: (result: proveUi_promptUsername_result) => void
    }
  ) => void,
  'keybase.1.proveUi.outputPrechecks'?: (
    params: {
      sessionID: int,
      text: proveUi_Text
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.proveUi.preProofWarning'?: (
    params: {
      sessionID: int,
      text: proveUi_Text
    },
    response: {
      error: (err: string) => void,
      result: (result: proveUi_preProofWarning_result) => void
    }
  ) => void,
  'keybase.1.proveUi.outputInstructions'?: (
    params: {
      sessionID: int,
      instructions: proveUi_Text,
      proof: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.proveUi.okToCheck'?: (
    params: {
      sessionID: int,
      name: string,
      attempt: int
    },
    response: {
      error: (err: string) => void,
      result: (result: proveUi_okToCheck_result) => void
    }
  ) => void,
  'keybase.1.proveUi.displayRecheckWarning'?: (
    params: {
      sessionID: int,
      text: proveUi_Text
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.provisionUi.chooseProvisioningMethod'?: (
    params: {
      sessionID: int,
      gpgOption: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: provisionUi_chooseProvisioningMethod_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.chooseDeviceType'?: (
    params: {
      sessionID: int,
      kind: provisionUi_ChooseType
    },
    response: {
      error: (err: string) => void,
      result: (result: provisionUi_chooseDeviceType_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.DisplayAndPromptSecret'?: (
    params: {
      sessionID: int,
      secret: bytes,
      phrase: string,
      otherDeviceType: provisionUi_DeviceType
    },
    response: {
      error: (err: string) => void,
      result: (result: provisionUi_DisplayAndPromptSecret_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.DisplaySecretExchanged'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.provisionUi.PromptNewDeviceName'?: (
    params: {
      sessionID: int,
      existingDevices: Array<string>
    },
    response: {
      error: (err: string) => void,
      result: (result: provisionUi_PromptNewDeviceName_result) => void
    }
  ) => void,
  'keybase.1.provisionUi.ProvisioneeSuccess'?: (
    params: {
      sessionID: int,
      username: string,
      deviceName: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.provisionUi.ProvisionerSuccess'?: (
    params: {
      sessionID: int,
      deviceName: string,
      deviceType: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.quota.verifySession'?: (
    params: {
      session: string
    },
    response: {
      error: (err: string) => void,
      result: (result: quota_verifySession_result) => void
    }
  ) => void,
  'keybase.1.revoke.revokeKey'?: (
    params: {
      sessionID: int,
      keyID: revoke_KID
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.revoke.revokeDevice'?: (
    params: {
      sessionID: int,
      deviceID: revoke_DeviceID,
      force: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.revoke.revokeSigs'?: (
    params: {
      sessionID: int,
      sigIDQueries: Array<string>
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackEncrypt'?: (
    params: {
      sessionID: int,
      source: saltpack_Stream,
      sink: saltpack_Stream,
      opts: saltpack_SaltpackEncryptOptions
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackDecrypt'?: (
    params: {
      sessionID: int,
      source: saltpack_Stream,
      sink: saltpack_Stream,
      opts: saltpack_SaltpackDecryptOptions
    },
    response: {
      error: (err: string) => void,
      result: (result: saltpack_saltpackDecrypt_result) => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackSign'?: (
    params: {
      sessionID: int,
      source: saltpack_Stream,
      sink: saltpack_Stream,
      opts: saltpack_SaltpackSignOptions
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpack.saltpackVerify'?: (
    params: {
      sessionID: int,
      source: saltpack_Stream,
      sink: saltpack_Stream,
      opts: saltpack_SaltpackVerifyOptions
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpackUi.saltpackPromptForDecrypt'?: (
    params: {
      sessionID: int,
      sender: saltpackUi_SaltpackSender
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.saltpackUi.saltpackVerifySuccess'?: (
    params: {
      sessionID: int,
      signingKID: saltpackUi_KID,
      sender: saltpackUi_SaltpackSender
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.secretUi.getPassphrase'?: (
    params: {
      sessionID: int,
      pinentry: secretUi_GUIEntryArg,
      terminal: (null | SecretEntryArg)
    },
    response: {
      error: (err: string) => void,
      result: (result: secretUi_getPassphrase_result) => void
    }
  ) => void,
  'keybase.1.SecretKeys.getSecretKeys'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: SecretKeys_getSecretKeys_result) => void
    }
  ) => void,
  'keybase.1.session.currentSession'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: session_currentSession_result) => void
    }
  ) => void,
  'keybase.1.signup.checkUsernameAvailable'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.signup.signup'?: (
    params: {
      sessionID: int,
      email: string,
      inviteCode: string,
      passphrase: string,
      username: string,
      deviceName: string,
      storeSecret: boolean,
      skipMail: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: signup_signup_result) => void
    }
  ) => void,
  'keybase.1.signup.inviteRequest'?: (
    params: {
      sessionID: int,
      email: string,
      fullname: string,
      notes: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.sigs.sigList'?: (
    params: {
      sessionID: int,
      arg: sigs_SigListArgs
    },
    response: {
      error: (err: string) => void,
      result: (result: sigs_sigList_result) => void
    }
  ) => void,
  'keybase.1.sigs.sigListJSON'?: (
    params: {
      sessionID: int,
      arg: sigs_SigListArgs
    },
    response: {
      error: (err: string) => void,
      result: (result: sigs_sigListJSON_result) => void
    }
  ) => void,
  'keybase.1.streamUi.close'?: (
    params: {
      sessionID: int,
      s: streamUi_Stream
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.streamUi.read'?: (
    params: {
      sessionID: int,
      s: streamUi_Stream,
      sz: int
    },
    response: {
      error: (err: string) => void,
      result: (result: streamUi_read_result) => void
    }
  ) => void,
  'keybase.1.streamUi.write'?: (
    params: {
      sessionID: int,
      s: streamUi_Stream,
      buf: bytes
    },
    response: {
      error: (err: string) => void,
      result: (result: streamUi_write_result) => void
    }
  ) => void,
  'keybase.1.test.test'?: (
    params: {
      sessionID: int,
      name: string
    },
    response: {
      error: (err: string) => void,
      result: (result: test_test_result) => void
    }
  ) => void,
  'keybase.1.test.testCallback'?: (
    params: {
      sessionID: int,
      name: string
    },
    response: {
      error: (err: string) => void,
      result: (result: test_testCallback_result) => void
    }
  ) => void,
  'keybase.1.test.panic'?: (
    params: {
      message: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.track'?: (
    params: {
      sessionID: int,
      userAssertion: string,
      options: track_TrackOptions,
      forceRemoteCheck: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.trackWithToken'?: (
    params: {
      sessionID: int,
      trackToken: track_TrackToken,
      options: track_TrackOptions
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.untrack'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.checkTracking'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.track.fakeTrackingChanged'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.ui.promptYesNo'?: (
    params: {
      sessionID: int,
      text: ui_Text,
      promptDefault: ui_PromptDefault
    },
    response: {
      error: (err: string) => void,
      result: (result: ui_promptYesNo_result) => void
    }
  ) => void,
  'keybase.1.update.update'?: (
    params: {
      options: update_UpdateOptions
    },
    response: {
      error: (err: string) => void,
      result: (result: update_update_result) => void
    }
  ) => void,
  'keybase.1.update.updateCheck'?: (
    params: {
      force: boolean
    },
    response: {
      error: (err: string) => void,
      result: () => void
    }
  ) => void,
  'keybase.1.updateUi.updatePrompt'?: (
    params: {
      sessionID: int,
      update: updateUi_Update,
      options: updateUi_UpdatePromptOptions
    },
    response: {
      error: (err: string) => void,
      result: (result: updateUi_updatePrompt_result) => void
    }
  ) => void,
  'keybase.1.updateUi.updateQuit'?: (
    params: {},
    response: {
      error: (err: string) => void,
      result: (result: updateUi_updateQuit_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackers'?: (
    params: {
      sessionID: int,
      uid: user_UID
    },
    response: {
      error: (err: string) => void,
      result: (result: user_listTrackers_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackersByName'?: (
    params: {
      sessionID: int,
      username: string
    },
    response: {
      error: (err: string) => void,
      result: (result: user_listTrackersByName_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackersSelf'?: (
    params: {
      sessionID: int
    },
    response: {
      error: (err: string) => void,
      result: (result: user_listTrackersSelf_result) => void
    }
  ) => void,
  'keybase.1.user.loadUncheckedUserSummaries'?: (
    params: {
      sessionID: int,
      uids: Array<user_UID>
    },
    response: {
      error: (err: string) => void,
      result: (result: user_loadUncheckedUserSummaries_result) => void
    }
  ) => void,
  'keybase.1.user.loadUser'?: (
    params: {
      sessionID: int,
      uid: user_UID
    },
    response: {
      error: (err: string) => void,
      result: (result: user_loadUser_result) => void
    }
  ) => void,
  'keybase.1.user.loadUserPlusKeys'?: (
    params: {
      sessionID: int,
      uid: user_UID,
      cacheOK: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: user_loadUserPlusKeys_result) => void
    }
  ) => void,
  'keybase.1.user.loadPublicKeys'?: (
    params: {
      sessionID: int,
      uid: user_UID
    },
    response: {
      error: (err: string) => void,
      result: (result: user_loadPublicKeys_result) => void
    }
  ) => void,
  'keybase.1.user.listTracking'?: (
    params: {
      sessionID: int,
      filter: string
    },
    response: {
      error: (err: string) => void,
      result: (result: user_listTracking_result) => void
    }
  ) => void,
  'keybase.1.user.listTrackingJSON'?: (
    params: {
      sessionID: int,
      filter: string,
      verbose: boolean
    },
    response: {
      error: (err: string) => void,
      result: (result: user_listTrackingJSON_result) => void
    }
  ) => void,
  'keybase.1.user.search'?: (
    params: {
      sessionID: int,
      query: string
    },
    response: {
      error: (err: string) => void,
      result: (result: user_search_result) => void
    }
  ) => void
}

export type account_Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type account_GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type account_PassphraseType = 0 /* 'NONE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASS_PHRASE_2' */ | 3 /* 'VERIFY_PASS_PHRASE_3' */

export type PassphraseType = 0 /* 'NONE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASS_PHRASE_2' */ | 3 /* 'VERIFY_PASS_PHRASE_3' */

export type account_GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  type: PassphraseType;
  features: GUIEntryFeatures;
}

export type GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  type: PassphraseType;
  features: GUIEntryFeatures;
}

export type account_GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

// account.passphraseChange ////////////////////////////////////////

/* void response */

export type account_passphraseChange_rpc = {
  method: 'account.passphraseChange',
  param: {
    oldPassphrase: string,
    passphrase: string,
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// account.passphrasePrompt ////////////////////////////////////////

export type account_passphrasePrompt_result = account_GetPassphraseRes

export type account_passphrasePrompt_rpc = {
  method: 'account.passphrasePrompt',
  param: {
    guiArg: account_GUIEntryArg
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: account_passphrasePrompt_result) => void)
}

export type block_Time = long

export type Time = long

export type block_StringKVPair = {
  key: string;
  value: string;
}

export type StringKVPair = {
  key: string;
  value: string;
}

export type block_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type block_UID = string

export type UID = string

export type block_DeviceID = string

export type DeviceID = string

export type block_SigID = string

export type SigID = string

export type block_KID = string

export type KID = string

export type block_Text = {
  data: string;
  markup: boolean;
}

export type Text = {
  data: string;
  markup: boolean;
}

export type block_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type block_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type block_User = {
  uid: UID;
  username: string;
}

export type User = {
  uid: UID;
  username: string;
}

export type block_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type block_Stream = {
  fd: int;
}

export type Stream = {
  fd: int;
}

export type block_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type block_ClientType = 2 /* FORCE GUI ONLY */

export type ClientType = 2 /* FORCE GUI ONLY */

export type block_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type block_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type block_BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type block_ChallengeInfo = {
  now: long;
  challenge: string;
}

export type ChallengeInfo = {
  now: long;
  challenge: string;
}

export type block_GetBlockRes = {
  blockKey: string;
  buf: bytes;
}

export type GetBlockRes = {
  blockKey: string;
  buf: bytes;
}

export type block_BlockRefNonce = any

export type BlockRefNonce = any

export type block_BlockReference = {
  bid: BlockIdCombo;
  nonce: BlockRefNonce;
  chargedTo: UID;
}

export type BlockReference = {
  bid: BlockIdCombo;
  nonce: BlockRefNonce;
  chargedTo: UID;
}

// block.getSessionChallenge ////////////////////////////////////////

export type block_getSessionChallenge_result = block_ChallengeInfo

export type block_getSessionChallenge_rpc = {
  method: 'block.getSessionChallenge',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_getSessionChallenge_result) => void)
}

// block.authenticateSession ////////////////////////////////////////

/* void response */

export type block_authenticateSession_rpc = {
  method: 'block.authenticateSession',
  param: {
    signature: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// block.putBlock ////////////////////////////////////////

/* void response */

export type block_putBlock_rpc = {
  method: 'block.putBlock',
  param: {
    bid: block_BlockIdCombo,
    folder: string,
    blockKey: string,
    buf: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// block.getBlock ////////////////////////////////////////

export type block_getBlock_result = block_GetBlockRes

export type block_getBlock_rpc = {
  method: 'block.getBlock',
  param: {
    bid: block_BlockIdCombo,
    folder: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_getBlock_result) => void)
}

// block.addReference ////////////////////////////////////////

/* void response */

export type block_addReference_rpc = {
  method: 'block.addReference',
  param: {
    folder: string,
    ref: block_BlockReference
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// block.delReference ////////////////////////////////////////

/* void response */

export type block_delReference_rpc = {
  method: 'block.delReference',
  param: {
    folder: string,
    ref: block_BlockReference
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// block.archiveReference ////////////////////////////////////////

export type block_archiveReference_result = Array<block_BlockReference>

export type block_archiveReference_rpc = {
  method: 'block.archiveReference',
  param: {
    folder: string,
    refs: Array<block_BlockReference>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_archiveReference_result) => void)
}

// block.getUserQuotaInfo ////////////////////////////////////////

export type block_getUserQuotaInfo_result = bytes

export type block_getUserQuotaInfo_rpc = {
  method: 'block.getUserQuotaInfo',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: block_getUserQuotaInfo_result) => void)
}

export type BTC_Time = long

export type BTC_StringKVPair = {
  key: string;
  value: string;
}

export type BTC_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type BTC_UID = string

export type BTC_DeviceID = string

export type BTC_SigID = string

export type BTC_KID = string

export type BTC_Text = {
  data: string;
  markup: boolean;
}

export type BTC_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type BTC_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type BTC_User = {
  uid: UID;
  username: string;
}

export type BTC_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type BTC_Stream = {
  fd: int;
}

export type BTC_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type BTC_ClientType = 2 /* FORCE GUI ONLY */

export type BTC_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type BTC_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// BTC.registerBTC ////////////////////////////////////////

/* void response */

export type BTC_registerBTC_rpc = {
  method: 'BTC.registerBTC',
  param: {
    address: string,
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type config_Time = long

export type config_StringKVPair = {
  key: string;
  value: string;
}

export type config_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type config_UID = string

export type config_DeviceID = string

export type config_SigID = string

export type config_KID = string

export type config_Text = {
  data: string;
  markup: boolean;
}

export type config_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type config_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type config_User = {
  uid: UID;
  username: string;
}

export type config_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type config_Stream = {
  fd: int;
}

export type config_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type config_ClientType = 2 /* FORCE GUI ONLY */

export type config_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type config_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type config_GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  user?: ?User;
}

export type GetCurrentStatusRes = {
  configured: boolean;
  registered: boolean;
  loggedIn: boolean;
  user?: ?User;
}

export type config_SessionStatus = {
  SessionFor: string;
  Loaded: boolean;
  Cleared: boolean;
  SaltOnly: boolean;
  Expired: boolean;
}

export type SessionStatus = {
  SessionFor: string;
  Loaded: boolean;
  Cleared: boolean;
  SaltOnly: boolean;
  Expired: boolean;
}

export type config_ClientDetails = {
  pid: int;
  clientType: ClientType;
  argv: Array<string>;
  desc: string;
  version: string;
}

export type ClientDetails = {
  pid: int;
  clientType: ClientType;
  argv: Array<string>;
  desc: string;
  version: string;
}

export type config_PlatformInfo = {
  os: string;
  arch: string;
  goVersion: string;
}

export type PlatformInfo = {
  os: string;
  arch: string;
  goVersion: string;
}

export type config_ExtendedStatus = {
  standalone: boolean;
  passphraseStreamCached: boolean;
  device?: ?Device;
  logDir: string;
  desktopUIConnected: boolean;
  session?: ?SessionStatus;
  defaultUsername: string;
  provisionedUsernames: Array<string>;
  Clients: Array<ClientDetails>;
  platformInfo: PlatformInfo;
}

export type ExtendedStatus = {
  standalone: boolean;
  passphraseStreamCached: boolean;
  device?: ?Device;
  logDir: string;
  desktopUIConnected: boolean;
  session?: ?SessionStatus;
  defaultUsername: string;
  provisionedUsernames: Array<string>;
  Clients: Array<ClientDetails>;
  platformInfo: PlatformInfo;
}

export type config_ForkType = 0 /* 'NONE_0' */ | 1 /* 'AUTO_1' */ | 2 /* 'WATCHDOG_2' */ | 3 /* 'LAUNCHD_3' */

export type ForkType = 0 /* 'NONE_0' */ | 1 /* 'AUTO_1' */ | 2 /* 'WATCHDOG_2' */ | 3 /* 'LAUNCHD_3' */

export type config_Config = {
  serverURI: string;
  socketFile: string;
  label: string;
  runMode: string;
  gpgExists: boolean;
  gpgPath: string;
  version: string;
  path: string;
  configPath: string;
  versionShort: string;
  versionFull: string;
  isAutoForked: boolean;
  forkType: ForkType;
}

export type Config = {
  serverURI: string;
  socketFile: string;
  label: string;
  runMode: string;
  gpgExists: boolean;
  gpgPath: string;
  version: string;
  path: string;
  configPath: string;
  versionShort: string;
  versionFull: string;
  isAutoForked: boolean;
  forkType: ForkType;
}

// config.getCurrentStatus ////////////////////////////////////////

export type config_getCurrentStatus_result = config_GetCurrentStatusRes

export type config_getCurrentStatus_rpc = {
  method: 'config.getCurrentStatus',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getCurrentStatus_result) => void)
}

// config.getExtendedStatus ////////////////////////////////////////

export type config_getExtendedStatus_result = config_ExtendedStatus

export type config_getExtendedStatus_rpc = {
  method: 'config.getExtendedStatus',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getExtendedStatus_result) => void)
}

// config.getConfig ////////////////////////////////////////

export type config_getConfig_result = config_Config

export type config_getConfig_rpc = {
  method: 'config.getConfig',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: config_getConfig_result) => void)
}

// config.setUserConfig ////////////////////////////////////////

/* void response */

export type config_setUserConfig_rpc = {
  method: 'config.setUserConfig',
  param: {
    username: string,
    key: string,
    value: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// config.setPath ////////////////////////////////////////

/* void response */

export type config_setPath_rpc = {
  method: 'config.setPath',
  param: {
    path: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// config.helloIAm ////////////////////////////////////////

/* void response */

export type config_helloIAm_rpc = {
  method: 'config.helloIAm',
  param: {
    details: config_ClientDetails
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type constants_StatusCode = 0 /* 'SCOk_0' */ | 201 /* 'SCLoginRequired_201' */ | 202 /* 'SCBadSession_202' */ | 203 /* 'SCBadLoginUserNotFound_203' */ | 204 /* 'SCBadLoginPassword_204' */ | 205 /* 'SCNotFound_205' */ | 218 /* 'SCGeneric_218' */ | 235 /* 'SCAlreadyLoggedIn_235' */ | 237 /* 'SCCanceled_237' */ | 239 /* 'SCInputCanceled_239' */ | 274 /* 'SCReloginRequired_274' */ | 275 /* 'SCResolutionFailed_275' */ | 276 /* 'SCProfileNotPublic_276' */ | 277 /* 'SCIdentifyFailed_277' */ | 278 /* 'SCTrackingBroke_278' */ | 279 /* 'SCWrongCryptoFormat_279' */ | 701 /* 'SCBadSignupUsernameTaken_701' */ | 801 /* 'SCMissingResult_801' */ | 901 /* 'SCKeyNotFound_901' */ | 907 /* 'SCKeyInUse_907' */ | 913 /* 'SCKeyBadGen_913' */ | 914 /* 'SCKeyNoSecret_914' */ | 915 /* 'SCKeyBadUIDs_915' */ | 916 /* 'SCKeyNoActive_916' */ | 917 /* 'SCKeyNoSig_917' */ | 918 /* 'SCKeyBadSig_918' */ | 919 /* 'SCKeyBadEldest_919' */ | 920 /* 'SCKeyNoEldest_920' */ | 921 /* 'SCKeyDuplicateUpdate_921' */ | 922 /* 'SCSibkeyAlreadyExists_922' */ | 924 /* 'SCDecryptionKeyNotFound_924' */ | 927 /* 'SCKeyNoPGPEncryption_927' */ | 928 /* 'SCKeyNoNaClEncryption_928' */ | 929 /* 'SCKeySyncedPGPNotFound_929' */ | 1301 /* 'SCBadTrackSession_1301' */ | 1409 /* 'SCDeviceNotFound_1409' */ | 1410 /* 'SCDeviceMismatch_1410' */ | 1411 /* 'SCDeviceRequired_1411' */ | 1501 /* 'SCStreamExists_1501' */ | 1502 /* 'SCStreamNotFound_1502' */ | 1503 /* 'SCStreamWrongKind_1503' */ | 1504 /* 'SCStreamEOF_1504' */ | 1601 /* 'SCAPINetworkError_1601' */ | 1602 /* 'SCTimeout_1602' */ | 1701 /* 'SCProofError_1701' */ | 1702 /* 'SCIdentificationExpired_1702' */ | 1703 /* 'SCSelfNotFound_1703' */ | 1704 /* 'SCBadKexPhrase_1704' */ | 1705 /* 'SCNoUIDelegation_1705' */ | 1706 /* 'SCNoUI_1706' */ | 1800 /* 'SCInvalidVersionError_1800' */ | 1801 /* 'SCOldVersionError_1801' */ | 1802 /* 'SCInvalidLocationError_1802' */ | 1803 /* 'SCServiceStatusError_1803' */ | 1804 /* 'SCInstallError_1804' */

export type StatusCode = 0 /* 'SCOk_0' */ | 201 /* 'SCLoginRequired_201' */ | 202 /* 'SCBadSession_202' */ | 203 /* 'SCBadLoginUserNotFound_203' */ | 204 /* 'SCBadLoginPassword_204' */ | 205 /* 'SCNotFound_205' */ | 218 /* 'SCGeneric_218' */ | 235 /* 'SCAlreadyLoggedIn_235' */ | 237 /* 'SCCanceled_237' */ | 239 /* 'SCInputCanceled_239' */ | 274 /* 'SCReloginRequired_274' */ | 275 /* 'SCResolutionFailed_275' */ | 276 /* 'SCProfileNotPublic_276' */ | 277 /* 'SCIdentifyFailed_277' */ | 278 /* 'SCTrackingBroke_278' */ | 279 /* 'SCWrongCryptoFormat_279' */ | 701 /* 'SCBadSignupUsernameTaken_701' */ | 801 /* 'SCMissingResult_801' */ | 901 /* 'SCKeyNotFound_901' */ | 907 /* 'SCKeyInUse_907' */ | 913 /* 'SCKeyBadGen_913' */ | 914 /* 'SCKeyNoSecret_914' */ | 915 /* 'SCKeyBadUIDs_915' */ | 916 /* 'SCKeyNoActive_916' */ | 917 /* 'SCKeyNoSig_917' */ | 918 /* 'SCKeyBadSig_918' */ | 919 /* 'SCKeyBadEldest_919' */ | 920 /* 'SCKeyNoEldest_920' */ | 921 /* 'SCKeyDuplicateUpdate_921' */ | 922 /* 'SCSibkeyAlreadyExists_922' */ | 924 /* 'SCDecryptionKeyNotFound_924' */ | 927 /* 'SCKeyNoPGPEncryption_927' */ | 928 /* 'SCKeyNoNaClEncryption_928' */ | 929 /* 'SCKeySyncedPGPNotFound_929' */ | 1301 /* 'SCBadTrackSession_1301' */ | 1409 /* 'SCDeviceNotFound_1409' */ | 1410 /* 'SCDeviceMismatch_1410' */ | 1411 /* 'SCDeviceRequired_1411' */ | 1501 /* 'SCStreamExists_1501' */ | 1502 /* 'SCStreamNotFound_1502' */ | 1503 /* 'SCStreamWrongKind_1503' */ | 1504 /* 'SCStreamEOF_1504' */ | 1601 /* 'SCAPINetworkError_1601' */ | 1602 /* 'SCTimeout_1602' */ | 1701 /* 'SCProofError_1701' */ | 1702 /* 'SCIdentificationExpired_1702' */ | 1703 /* 'SCSelfNotFound_1703' */ | 1704 /* 'SCBadKexPhrase_1704' */ | 1705 /* 'SCNoUIDelegation_1705' */ | 1706 /* 'SCNoUI_1706' */ | 1800 /* 'SCInvalidVersionError_1800' */ | 1801 /* 'SCOldVersionError_1801' */ | 1802 /* 'SCInvalidLocationError_1802' */ | 1803 /* 'SCServiceStatusError_1803' */ | 1804 /* 'SCInstallError_1804' */

export type crypto_Time = long

export type crypto_StringKVPair = {
  key: string;
  value: string;
}

export type crypto_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type crypto_UID = string

export type crypto_DeviceID = string

export type crypto_SigID = string

export type crypto_KID = string

export type crypto_Text = {
  data: string;
  markup: boolean;
}

export type crypto_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type crypto_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type crypto_User = {
  uid: UID;
  username: string;
}

export type crypto_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type crypto_Stream = {
  fd: int;
}

export type crypto_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type crypto_ClientType = 2 /* FORCE GUI ONLY */

export type crypto_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type crypto_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type crypto_ED25519PublicKey = any

export type ED25519PublicKey = any

export type crypto_ED25519Signature = any

export type ED25519Signature = any

export type crypto_ED25519SignatureInfo = {
  sig: ED25519Signature;
  publicKey: ED25519PublicKey;
}

export type ED25519SignatureInfo = {
  sig: ED25519Signature;
  publicKey: ED25519PublicKey;
}

export type crypto_Bytes32 = any

export type Bytes32 = any

export type crypto_EncryptedBytes32 = any

export type EncryptedBytes32 = any

export type crypto_BoxNonce = any

export type BoxNonce = any

export type crypto_BoxPublicKey = any

export type BoxPublicKey = any

export type crypto_CiphertextBundle = {
  kid: KID;
  ciphertext: EncryptedBytes32;
  nonce: BoxNonce;
  publicKey: BoxPublicKey;
}

export type CiphertextBundle = {
  kid: KID;
  ciphertext: EncryptedBytes32;
  nonce: BoxNonce;
  publicKey: BoxPublicKey;
}

export type crypto_UnboxAnyRes = {
  kid: KID;
  plaintext: Bytes32;
  index: int;
}

export type UnboxAnyRes = {
  kid: KID;
  plaintext: Bytes32;
  index: int;
}

// crypto.signED25519 ////////////////////////////////////////

export type crypto_signED25519_result = crypto_ED25519SignatureInfo

export type crypto_signED25519_rpc = {
  method: 'crypto.signED25519',
  param: {
    msg: bytes,
    reason: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_signED25519_result) => void)
}

// crypto.signToString ////////////////////////////////////////

export type crypto_signToString_result = string

export type crypto_signToString_rpc = {
  method: 'crypto.signToString',
  param: {
    msg: bytes,
    reason: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_signToString_result) => void)
}

// crypto.unboxBytes32 ////////////////////////////////////////

export type crypto_unboxBytes32_result = crypto_Bytes32

export type crypto_unboxBytes32_rpc = {
  method: 'crypto.unboxBytes32',
  param: {
    encryptedBytes32: crypto_EncryptedBytes32,
    nonce: crypto_BoxNonce,
    peersPublicKey: crypto_BoxPublicKey,
    reason: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_unboxBytes32_result) => void)
}

// crypto.unboxBytes32Any ////////////////////////////////////////

export type crypto_unboxBytes32Any_result = crypto_UnboxAnyRes

export type crypto_unboxBytes32Any_rpc = {
  method: 'crypto.unboxBytes32Any',
  param: {
    bundles: Array<crypto_CiphertextBundle>,
    reason: string,
    promptPaper: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: crypto_unboxBytes32Any_result) => void)
}

export type ctl_Time = long

export type ctl_StringKVPair = {
  key: string;
  value: string;
}

export type ctl_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type ctl_UID = string

export type ctl_DeviceID = string

export type ctl_SigID = string

export type ctl_KID = string

export type ctl_Text = {
  data: string;
  markup: boolean;
}

export type ctl_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type ctl_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type ctl_User = {
  uid: UID;
  username: string;
}

export type ctl_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type ctl_Stream = {
  fd: int;
}

export type ctl_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type ctl_ClientType = 2 /* FORCE GUI ONLY */

export type ctl_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type ctl_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type ctl_ExitCode = 0 /* 'OK_0' */ | 2 /* 'NOTOK_2' */ | 4 /* 'RESTART_4' */

export type ExitCode = 0 /* 'OK_0' */ | 2 /* 'NOTOK_2' */ | 4 /* 'RESTART_4' */

// ctl.stop ////////////////////////////////////////

/* void response */

export type ctl_stop_rpc = {
  method: 'ctl.stop',
  param: {
    exitCode: ctl_ExitCode
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// ctl.logRotate ////////////////////////////////////////

/* void response */

export type ctl_logRotate_rpc = {
  method: 'ctl.logRotate',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// ctl.reload ////////////////////////////////////////

/* void response */

export type ctl_reload_rpc = {
  method: 'ctl.reload',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// ctl.dbNuke ////////////////////////////////////////

/* void response */

export type ctl_dbNuke_rpc = {
  method: 'ctl.dbNuke',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type debugging_FirstStepResult = {
  valPlusTwo: int;
}

export type FirstStepResult = {
  valPlusTwo: int;
}

// debugging.firstStep ////////////////////////////////////////

export type debugging_firstStep_result = debugging_FirstStepResult

export type debugging_firstStep_rpc = {
  method: 'debugging.firstStep',
  param: {
    val: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: debugging_firstStep_result) => void)
}

// debugging.secondStep ////////////////////////////////////////

export type debugging_secondStep_result = int

export type debugging_secondStep_rpc = {
  method: 'debugging.secondStep',
  param: {
    val: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: debugging_secondStep_result) => void)
}

// debugging.increment ////////////////////////////////////////

export type debugging_increment_result = int

export type debugging_increment_rpc = {
  method: 'debugging.increment',
  param: {
    val: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: debugging_increment_result) => void)
}

export type delegateUiCtl_Time = long

export type delegateUiCtl_StringKVPair = {
  key: string;
  value: string;
}

export type delegateUiCtl_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type delegateUiCtl_UID = string

export type delegateUiCtl_DeviceID = string

export type delegateUiCtl_SigID = string

export type delegateUiCtl_KID = string

export type delegateUiCtl_Text = {
  data: string;
  markup: boolean;
}

export type delegateUiCtl_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type delegateUiCtl_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type delegateUiCtl_User = {
  uid: UID;
  username: string;
}

export type delegateUiCtl_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type delegateUiCtl_Stream = {
  fd: int;
}

export type delegateUiCtl_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type delegateUiCtl_ClientType = 2 /* FORCE GUI ONLY */

export type delegateUiCtl_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type delegateUiCtl_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// delegateUiCtl.registerIdentifyUI ////////////////////////////////////////

/* void response */

export type delegateUiCtl_registerIdentifyUI_rpc = {
  method: 'delegateUiCtl.registerIdentifyUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// delegateUiCtl.registerSecretUI ////////////////////////////////////////

/* void response */

export type delegateUiCtl_registerSecretUI_rpc = {
  method: 'delegateUiCtl.registerSecretUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// delegateUiCtl.registerUpdateUI ////////////////////////////////////////

/* void response */

export type delegateUiCtl_registerUpdateUI_rpc = {
  method: 'delegateUiCtl.registerUpdateUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type device_Time = long

export type device_StringKVPair = {
  key: string;
  value: string;
}

export type device_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type device_UID = string

export type device_DeviceID = string

export type device_SigID = string

export type device_KID = string

export type device_Text = {
  data: string;
  markup: boolean;
}

export type device_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type device_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type device_User = {
  uid: UID;
  username: string;
}

export type device_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type device_Stream = {
  fd: int;
}

export type device_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type device_ClientType = 2 /* FORCE GUI ONLY */

export type device_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type device_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// device.deviceList ////////////////////////////////////////

export type device_deviceList_result = Array<device_Device>

export type device_deviceList_rpc = {
  method: 'device.deviceList',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: device_deviceList_result) => void)
}

// device.deviceAdd ////////////////////////////////////////

/* void response */

export type device_deviceAdd_rpc = {
  method: 'device.deviceAdd',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type favorite_Time = long

export type favorite_StringKVPair = {
  key: string;
  value: string;
}

export type favorite_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type favorite_UID = string

export type favorite_DeviceID = string

export type favorite_SigID = string

export type favorite_KID = string

export type favorite_Text = {
  data: string;
  markup: boolean;
}

export type favorite_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type favorite_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type favorite_User = {
  uid: UID;
  username: string;
}

export type favorite_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type favorite_Stream = {
  fd: int;
}

export type favorite_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type favorite_ClientType = 2 /* FORCE GUI ONLY */

export type favorite_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type favorite_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type favorite_Folder = {
  name: string;
  private: boolean;
  notificationsOn: boolean;
}

export type Folder = {
  name: string;
  private: boolean;
  notificationsOn: boolean;
}

// favorite.favoriteAdd ////////////////////////////////////////

/* void response */

export type favorite_favoriteAdd_rpc = {
  method: 'favorite.favoriteAdd',
  param: {
    folder: favorite_Folder
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// favorite.favoriteDelete ////////////////////////////////////////

/* void response */

export type favorite_favoriteDelete_rpc = {
  method: 'favorite.favoriteDelete',
  param: {
    folder: favorite_Folder
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// favorite.favoriteList ////////////////////////////////////////

export type favorite_favoriteList_result = Array<favorite_Folder>

export type favorite_favoriteList_rpc = {
  method: 'favorite.favoriteList',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: favorite_favoriteList_result) => void)
}

export type gpgUi_Time = long

export type gpgUi_StringKVPair = {
  key: string;
  value: string;
}

export type gpgUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type gpgUi_UID = string

export type gpgUi_DeviceID = string

export type gpgUi_SigID = string

export type gpgUi_KID = string

export type gpgUi_Text = {
  data: string;
  markup: boolean;
}

export type gpgUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type gpgUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type gpgUi_User = {
  uid: UID;
  username: string;
}

export type gpgUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type gpgUi_Stream = {
  fd: int;
}

export type gpgUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type gpgUi_ClientType = 2 /* FORCE GUI ONLY */

export type gpgUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type gpgUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type gpgUi_GPGKey = {
  algorithm: string;
  keyID: string;
  creation: string;
  expiration: string;
  identities: Array<PGPIdentity>;
}

export type GPGKey = {
  algorithm: string;
  keyID: string;
  creation: string;
  expiration: string;
  identities: Array<PGPIdentity>;
}

export type gpgUi_SelectKeyRes = {
  keyID: string;
  doSecretPush: boolean;
}

export type SelectKeyRes = {
  keyID: string;
  doSecretPush: boolean;
}

// gpgUi.wantToAddGPGKey ////////////////////////////////////////

export type gpgUi_wantToAddGPGKey_result = boolean

export type gpgUi_wantToAddGPGKey_rpc = {
  method: 'gpgUi.wantToAddGPGKey',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_wantToAddGPGKey_result) => void)
}

// gpgUi.confirmDuplicateKeyChosen ////////////////////////////////////////

export type gpgUi_confirmDuplicateKeyChosen_result = boolean

export type gpgUi_confirmDuplicateKeyChosen_rpc = {
  method: 'gpgUi.confirmDuplicateKeyChosen',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_confirmDuplicateKeyChosen_result) => void)
}

// gpgUi.selectKeyAndPushOption ////////////////////////////////////////

export type gpgUi_selectKeyAndPushOption_result = gpgUi_SelectKeyRes

export type gpgUi_selectKeyAndPushOption_rpc = {
  method: 'gpgUi.selectKeyAndPushOption',
  param: {
    keys: Array<gpgUi_GPGKey>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_selectKeyAndPushOption_result) => void)
}

// gpgUi.selectKey ////////////////////////////////////////

export type gpgUi_selectKey_result = string

export type gpgUi_selectKey_rpc = {
  method: 'gpgUi.selectKey',
  param: {
    keys: Array<gpgUi_GPGKey>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_selectKey_result) => void)
}

// gpgUi.sign ////////////////////////////////////////

export type gpgUi_sign_result = string

export type gpgUi_sign_rpc = {
  method: 'gpgUi.sign',
  param: {
    msg: bytes,
    fingerprint: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: gpgUi_sign_result) => void)
}

export type identify_Time = long

export type identify_StringKVPair = {
  key: string;
  value: string;
}

export type identify_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type identify_UID = string

export type identify_DeviceID = string

export type identify_SigID = string

export type identify_KID = string

export type identify_Text = {
  data: string;
  markup: boolean;
}

export type identify_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type identify_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type identify_User = {
  uid: UID;
  username: string;
}

export type identify_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type identify_Stream = {
  fd: int;
}

export type identify_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type identify_ClientType = 2 /* FORCE GUI ONLY */

export type identify_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type identify_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type identify_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type identify_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type identify_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type identify_TrackToken = string

export type TrackToken = string

export type identify_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type identify_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type identify_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type identify_TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type identify_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type identify_IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type identify_IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type identify_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type identify_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type identify_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type identify_Identify2Res = {
  upk: UserPlusKeys;
}

export type Identify2Res = {
  upk: UserPlusKeys;
}

// identify.Resolve ////////////////////////////////////////

export type identify_Resolve_result = identify_UID

export type identify_Resolve_rpc = {
  method: 'identify.Resolve',
  param: {
    assertion: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_Resolve_result) => void)
}

// identify.Resolve2 ////////////////////////////////////////

export type identify_Resolve2_result = identify_User

export type identify_Resolve2_rpc = {
  method: 'identify.Resolve2',
  param: {
    assertion: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_Resolve2_result) => void)
}

// identify.identify ////////////////////////////////////////

export type identify_identify_result = identify_IdentifyRes

export type identify_identify_rpc = {
  method: 'identify.identify',
  param: {
    userAssertion: string,
    trackStatement: boolean,
    forceRemoteCheck: boolean,
    useDelegateUI: boolean,
    reason: identify_IdentifyReason,
    source: identify_ClientType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_identify_result) => void)
}

// identify.identify2 ////////////////////////////////////////

export type identify_identify2_result = identify_Identify2Res

export type identify_identify2_rpc = {
  method: 'identify.identify2',
  param: {
    uid: identify_UID,
    userAssertion: string,
    reason: identify_IdentifyReason,
    useDelegateUI: boolean,
    alwaysBlock: boolean,
    noErrorOnTrackFailure: boolean,
    forceRemoteCheck: boolean,
    needProofSet: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identify_identify2_result) => void)
}

export type identifyUi_Time = long

export type identifyUi_StringKVPair = {
  key: string;
  value: string;
}

export type identifyUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type identifyUi_UID = string

export type identifyUi_DeviceID = string

export type identifyUi_SigID = string

export type identifyUi_KID = string

export type identifyUi_Text = {
  data: string;
  markup: boolean;
}

export type identifyUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type identifyUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type identifyUi_User = {
  uid: UID;
  username: string;
}

export type identifyUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type identifyUi_Stream = {
  fd: int;
}

export type identifyUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type identifyUi_ClientType = 2 /* FORCE GUI ONLY */

export type identifyUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type identifyUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type identifyUi_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type identifyUi_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type identifyUi_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type identifyUi_TrackToken = string

export type identifyUi_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type identifyUi_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type identifyUi_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type identifyUi_TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type identifyUi_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type identifyUi_IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type identifyUi_IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type identifyUi_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type identifyUi_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type identifyUi_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type identifyUi_ProofResult = {
  state: ProofState;
  status: ProofStatus;
  desc: string;
}

export type ProofResult = {
  state: ProofState;
  status: ProofStatus;
  desc: string;
}

export type identifyUi_IdentifyRow = {
  rowId: int;
  proof: RemoteProof;
  trackDiff?: ?TrackDiff;
}

export type IdentifyRow = {
  rowId: int;
  proof: RemoteProof;
  trackDiff?: ?TrackDiff;
}

export type identifyUi_IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff?: ?TrackDiff;
}

export type IdentifyKey = {
  pgpFingerprint: bytes;
  KID: KID;
  trackDiff?: ?TrackDiff;
}

export type identifyUi_Cryptocurrency = {
  rowId: int;
  pkhash: bytes;
  address: string;
}

export type Cryptocurrency = {
  rowId: int;
  pkhash: bytes;
  address: string;
}

export type identifyUi_Identity = {
  status?: ?Status;
  whenLastTracked: int;
  proofs: Array<IdentifyRow>;
  cryptocurrency: Array<Cryptocurrency>;
  revoked: Array<TrackDiff>;
}

export type Identity = {
  status?: ?Status;
  whenLastTracked: int;
  proofs: Array<IdentifyRow>;
  cryptocurrency: Array<Cryptocurrency>;
  revoked: Array<TrackDiff>;
}

export type identifyUi_SigHint = {
  remoteId: string;
  humanUrl: string;
  apiUrl: string;
  checkText: string;
}

export type SigHint = {
  remoteId: string;
  humanUrl: string;
  apiUrl: string;
  checkText: string;
}

export type identifyUi_CheckResultFreshness = 0 /* 'FRESH_0' */ | 1 /* 'AGED_1' */ | 2 /* 'RANCID_2' */

export type CheckResultFreshness = 0 /* 'FRESH_0' */ | 1 /* 'AGED_1' */ | 2 /* 'RANCID_2' */

export type identifyUi_CheckResult = {
  proofResult: ProofResult;
  time: Time;
  freshness: CheckResultFreshness;
}

export type CheckResult = {
  proofResult: ProofResult;
  time: Time;
  freshness: CheckResultFreshness;
}

export type identifyUi_LinkCheckResult = {
  proofId: int;
  proofResult: ProofResult;
  snoozedResult: ProofResult;
  torWarning: boolean;
  cached?: ?CheckResult;
  diff?: ?TrackDiff;
  remoteDiff?: ?TrackDiff;
  hint?: ?SigHint;
}

export type LinkCheckResult = {
  proofId: int;
  proofResult: ProofResult;
  snoozedResult: ProofResult;
  torWarning: boolean;
  cached?: ?CheckResult;
  diff?: ?TrackDiff;
  remoteDiff?: ?TrackDiff;
  hint?: ?SigHint;
}

export type identifyUi_UserCard = {
  following: int;
  followers: int;
  uid: UID;
  fullName: string;
  location: string;
  bio: string;
  website: string;
  twitter: string;
  youFollowThem: boolean;
  theyFollowYou: boolean;
}

export type UserCard = {
  following: int;
  followers: int;
  uid: UID;
  fullName: string;
  location: string;
  bio: string;
  website: string;
  twitter: string;
  youFollowThem: boolean;
  theyFollowYou: boolean;
}

export type identifyUi_ConfirmResult = {
  identityConfirmed: boolean;
  remoteConfirmed: boolean;
}

export type ConfirmResult = {
  identityConfirmed: boolean;
  remoteConfirmed: boolean;
}

// identifyUi.delegateIdentifyUI ////////////////////////////////////////

export type identifyUi_delegateIdentifyUI_result = int

export type identifyUi_delegateIdentifyUI_rpc = {
  method: 'identifyUi.delegateIdentifyUI',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identifyUi_delegateIdentifyUI_result) => void)
}

// identifyUi.start ////////////////////////////////////////

/* void response */

export type identifyUi_start_rpc = {
  method: 'identifyUi.start',
  param: {
    username: string,
    reason: identifyUi_IdentifyReason
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.displayKey ////////////////////////////////////////

/* void response */

export type identifyUi_displayKey_rpc = {
  method: 'identifyUi.displayKey',
  param: {
    key: identifyUi_IdentifyKey
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.reportLastTrack ////////////////////////////////////////

/* void response */

export type identifyUi_reportLastTrack_rpc = {
  method: 'identifyUi.reportLastTrack',
  param: {
    track: (null | TrackSummary)
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.launchNetworkChecks ////////////////////////////////////////

/* void response */

export type identifyUi_launchNetworkChecks_rpc = {
  method: 'identifyUi.launchNetworkChecks',
  param: {
    identity: identifyUi_Identity,
    user: identifyUi_User
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.displayTrackStatement ////////////////////////////////////////

/* void response */

export type identifyUi_displayTrackStatement_rpc = {
  method: 'identifyUi.displayTrackStatement',
  param: {
    stmt: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.finishWebProofCheck ////////////////////////////////////////

/* void response */

export type identifyUi_finishWebProofCheck_rpc = {
  method: 'identifyUi.finishWebProofCheck',
  param: {
    rp: identifyUi_RemoteProof,
    lcr: identifyUi_LinkCheckResult
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.finishSocialProofCheck ////////////////////////////////////////

/* void response */

export type identifyUi_finishSocialProofCheck_rpc = {
  method: 'identifyUi.finishSocialProofCheck',
  param: {
    rp: identifyUi_RemoteProof,
    lcr: identifyUi_LinkCheckResult
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.displayCryptocurrency ////////////////////////////////////////

/* void response */

export type identifyUi_displayCryptocurrency_rpc = {
  method: 'identifyUi.displayCryptocurrency',
  param: {
    c: identifyUi_Cryptocurrency
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.reportTrackToken ////////////////////////////////////////

/* void response */

export type identifyUi_reportTrackToken_rpc = {
  method: 'identifyUi.reportTrackToken',
  param: {
    trackToken: identifyUi_TrackToken
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.displayUserCard ////////////////////////////////////////

/* void response */

export type identifyUi_displayUserCard_rpc = {
  method: 'identifyUi.displayUserCard',
  param: {
    card: identifyUi_UserCard
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// identifyUi.confirm ////////////////////////////////////////

export type identifyUi_confirm_result = identifyUi_ConfirmResult

export type identifyUi_confirm_rpc = {
  method: 'identifyUi.confirm',
  param: {
    outcome: identifyUi_IdentifyOutcome
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: identifyUi_confirm_result) => void)
}

// identifyUi.finish ////////////////////////////////////////

/* void response */

export type identifyUi_finish_rpc = {
  method: 'identifyUi.finish',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type install_Time = long

export type install_StringKVPair = {
  key: string;
  value: string;
}

export type install_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type install_UID = string

export type install_DeviceID = string

export type install_SigID = string

export type install_KID = string

export type install_Text = {
  data: string;
  markup: boolean;
}

export type install_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type install_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type install_User = {
  uid: UID;
  username: string;
}

export type install_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type install_Stream = {
  fd: int;
}

export type install_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type install_ClientType = 2 /* FORCE GUI ONLY */

export type install_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type install_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type install_InstallStatus = 0 /* 'UNKNOWN_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'NOT_INSTALLED_2' */ | 4 /* 'INSTALLED_4' */

export type InstallStatus = 0 /* 'UNKNOWN_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'NOT_INSTALLED_2' */ | 4 /* 'INSTALLED_4' */

export type install_InstallAction = 0 /* 'UNKNOWN_0' */ | 1 /* 'NONE_1' */ | 2 /* 'UPGRADE_2' */ | 3 /* 'REINSTALL_3' */ | 4 /* 'INSTALL_4' */

export type InstallAction = 0 /* 'UNKNOWN_0' */ | 1 /* 'NONE_1' */ | 2 /* 'UPGRADE_2' */ | 3 /* 'REINSTALL_3' */ | 4 /* 'INSTALL_4' */

export type install_ServiceStatus = {
  version: string;
  label: string;
  pid: string;
  lastExitStatus: string;
  bundleVersion: string;
  installStatus: InstallStatus;
  installAction: InstallAction;
  status: Status;
}

export type ServiceStatus = {
  version: string;
  label: string;
  pid: string;
  lastExitStatus: string;
  bundleVersion: string;
  installStatus: InstallStatus;
  installAction: InstallAction;
  status: Status;
}

export type install_ServicesStatus = {
  service: Array<ServiceStatus>;
  kbfs: Array<ServiceStatus>;
}

export type ServicesStatus = {
  service: Array<ServiceStatus>;
  kbfs: Array<ServiceStatus>;
}

export type install_FuseMountInfo = {
  path: string;
  fstype: string;
  output: string;
}

export type FuseMountInfo = {
  path: string;
  fstype: string;
  output: string;
}

export type install_FuseStatus = {
  version: string;
  bundleVersion: string;
  kextID: string;
  path: string;
  kextStarted: boolean;
  installStatus: InstallStatus;
  installAction: InstallAction;
  mountInfos: Array<FuseMountInfo>;
  status: Status;
}

export type FuseStatus = {
  version: string;
  bundleVersion: string;
  kextID: string;
  path: string;
  kextStarted: boolean;
  installStatus: InstallStatus;
  installAction: InstallAction;
  mountInfos: Array<FuseMountInfo>;
  status: Status;
}

export type install_ComponentResult = {
  name: string;
  status: Status;
}

export type ComponentResult = {
  name: string;
  status: Status;
}

export type install_InstallResult = {
  componentResults: Array<ComponentResult>;
  status: Status;
  fatal: boolean;
}

export type InstallResult = {
  componentResults: Array<ComponentResult>;
  status: Status;
  fatal: boolean;
}

export type install_UninstallResult = {
  componentResults: Array<ComponentResult>;
  status: Status;
}

export type UninstallResult = {
  componentResults: Array<ComponentResult>;
  status: Status;
}

export type kbfs_FSStatusCode = 0 /* 'START_0' */ | 1 /* 'FINISH_1' */ | 2 /* 'ERROR_2' */

export type FSStatusCode = 0 /* 'START_0' */ | 1 /* 'FINISH_1' */ | 2 /* 'ERROR_2' */

export type kbfs_FSNotificationType = 0 /* 'ENCRYPTING_0' */ | 1 /* 'DECRYPTING_1' */ | 2 /* 'SIGNING_2' */ | 3 /* 'VERIFYING_3' */ | 4 /* 'REKEYING_4' */

export type FSNotificationType = 0 /* 'ENCRYPTING_0' */ | 1 /* 'DECRYPTING_1' */ | 2 /* 'SIGNING_2' */ | 3 /* 'VERIFYING_3' */ | 4 /* 'REKEYING_4' */

export type kbfs_FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
}

export type FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
}

// kbfs.FSEvent ////////////////////////////////////////

/* void response */

export type kbfs_FSEvent_rpc = {
  method: 'kbfs.FSEvent',
  param: {
    event: kbfs_FSNotification
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type Kex2Provisionee_Time = long

export type Kex2Provisionee_StringKVPair = {
  key: string;
  value: string;
}

export type Kex2Provisionee_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type Kex2Provisionee_UID = string

export type Kex2Provisionee_DeviceID = string

export type Kex2Provisionee_SigID = string

export type Kex2Provisionee_KID = string

export type Kex2Provisionee_Text = {
  data: string;
  markup: boolean;
}

export type Kex2Provisionee_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type Kex2Provisionee_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type Kex2Provisionee_User = {
  uid: UID;
  username: string;
}

export type Kex2Provisionee_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type Kex2Provisionee_Stream = {
  fd: int;
}

export type Kex2Provisionee_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type Kex2Provisionee_ClientType = 2 /* FORCE GUI ONLY */

export type Kex2Provisionee_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type Kex2Provisionee_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type Kex2Provisionee_PassphraseStream = {
  passphraseStream: bytes;
  generation: int;
}

export type PassphraseStream = {
  passphraseStream: bytes;
  generation: int;
}

export type Kex2Provisionee_SessionToken = string

export type SessionToken = string

export type Kex2Provisionee_CsrfToken = string

export type CsrfToken = string

export type Kex2Provisionee_HelloRes = string

export type HelloRes = string

// Kex2Provisionee.hello ////////////////////////////////////////

export type Kex2Provisionee_hello_result = Kex2Provisionee_HelloRes

export type Kex2Provisionee_hello_rpc = {
  method: 'Kex2Provisionee.hello',
  param: {
    uid: Kex2Provisionee_UID,
    token: Kex2Provisionee_SessionToken,
    csrf: Kex2Provisionee_CsrfToken,
    pps: Kex2Provisionee_PassphraseStream,
    sigBody: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: Kex2Provisionee_hello_result) => void)
}

// Kex2Provisionee.didCounterSign ////////////////////////////////////////

/* void response */

export type Kex2Provisionee_didCounterSign_rpc = {
  method: 'Kex2Provisionee.didCounterSign',
  param: {
    sig: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// Kex2Provisioner.kexStart ////////////////////////////////////////

/* void response */

export type Kex2Provisioner_kexStart_rpc = {
  method: 'Kex2Provisioner.kexStart',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type log_Time = long

export type log_StringKVPair = {
  key: string;
  value: string;
}

export type log_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type log_UID = string

export type log_DeviceID = string

export type log_SigID = string

export type log_KID = string

export type log_Text = {
  data: string;
  markup: boolean;
}

export type log_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type log_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type log_User = {
  uid: UID;
  username: string;
}

export type log_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type log_Stream = {
  fd: int;
}

export type log_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type log_ClientType = 2 /* FORCE GUI ONLY */

export type log_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type log_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// log.registerLogger ////////////////////////////////////////

/* void response */

export type log_registerLogger_rpc = {
  method: 'log.registerLogger',
  param: {
    name: string,
    level: log_LogLevel
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type logUi_Time = long

export type logUi_StringKVPair = {
  key: string;
  value: string;
}

export type logUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type logUi_UID = string

export type logUi_DeviceID = string

export type logUi_SigID = string

export type logUi_KID = string

export type logUi_Text = {
  data: string;
  markup: boolean;
}

export type logUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type logUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type logUi_User = {
  uid: UID;
  username: string;
}

export type logUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type logUi_Stream = {
  fd: int;
}

export type logUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type logUi_ClientType = 2 /* FORCE GUI ONLY */

export type logUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type logUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// logUi.log ////////////////////////////////////////

/* void response */

export type logUi_log_rpc = {
  method: 'logUi.log',
  param: {
    level: logUi_LogLevel,
    text: logUi_Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type login_Time = long

export type login_StringKVPair = {
  key: string;
  value: string;
}

export type login_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type login_UID = string

export type login_DeviceID = string

export type login_SigID = string

export type login_KID = string

export type login_Text = {
  data: string;
  markup: boolean;
}

export type login_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type login_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type login_User = {
  uid: UID;
  username: string;
}

export type login_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type login_Stream = {
  fd: int;
}

export type login_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type login_ClientType = 2 /* FORCE GUI ONLY */

export type login_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type login_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type login_ConfiguredAccount = {
  username: string;
  hasStoredSecret: boolean;
}

export type ConfiguredAccount = {
  username: string;
  hasStoredSecret: boolean;
}

// login.getConfiguredAccounts ////////////////////////////////////////

export type login_getConfiguredAccounts_result = Array<login_ConfiguredAccount>

export type login_getConfiguredAccounts_rpc = {
  method: 'login.getConfiguredAccounts',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: login_getConfiguredAccounts_result) => void)
}

// login.login ////////////////////////////////////////

/* void response */

export type login_login_rpc = {
  method: 'login.login',
  param: {
    deviceType: string,
    username: string,
    clientType: login_ClientType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.clearStoredSecret ////////////////////////////////////////

/* void response */

export type login_clearStoredSecret_rpc = {
  method: 'login.clearStoredSecret',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.logout ////////////////////////////////////////

/* void response */

export type login_logout_rpc = {
  method: 'login.logout',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.deprovision ////////////////////////////////////////

/* void response */

export type login_deprovision_rpc = {
  method: 'login.deprovision',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.recoverAccountFromEmailAddress ////////////////////////////////////////

/* void response */

export type login_recoverAccountFromEmailAddress_rpc = {
  method: 'login.recoverAccountFromEmailAddress',
  param: {
    email: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.paperKey ////////////////////////////////////////

/* void response */

export type login_paperKey_rpc = {
  method: 'login.paperKey',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.unlock ////////////////////////////////////////

/* void response */

export type login_unlock_rpc = {
  method: 'login.unlock',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// login.unlockWithPassphrase ////////////////////////////////////////

/* void response */

export type login_unlockWithPassphrase_rpc = {
  method: 'login.unlockWithPassphrase',
  param: {
    passphrase: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type loginUi_Time = long

export type loginUi_StringKVPair = {
  key: string;
  value: string;
}

export type loginUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type loginUi_UID = string

export type loginUi_DeviceID = string

export type loginUi_SigID = string

export type loginUi_KID = string

export type loginUi_Text = {
  data: string;
  markup: boolean;
}

export type loginUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type loginUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type loginUi_User = {
  uid: UID;
  username: string;
}

export type loginUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type loginUi_Stream = {
  fd: int;
}

export type loginUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type loginUi_ClientType = 2 /* FORCE GUI ONLY */

export type loginUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type loginUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// loginUi.getEmailOrUsername ////////////////////////////////////////

export type loginUi_getEmailOrUsername_result = string

export type loginUi_getEmailOrUsername_rpc = {
  method: 'loginUi.getEmailOrUsername',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: loginUi_getEmailOrUsername_result) => void)
}

// loginUi.promptRevokePaperKeys ////////////////////////////////////////

export type loginUi_promptRevokePaperKeys_result = boolean

export type loginUi_promptRevokePaperKeys_rpc = {
  method: 'loginUi.promptRevokePaperKeys',
  param: {
    device: loginUi_Device,
    index: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: loginUi_promptRevokePaperKeys_result) => void)
}

// loginUi.displayPaperKeyPhrase ////////////////////////////////////////

/* void response */

export type loginUi_displayPaperKeyPhrase_rpc = {
  method: 'loginUi.displayPaperKeyPhrase',
  param: {
    phrase: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// loginUi.displayPrimaryPaperKey ////////////////////////////////////////

/* void response */

export type loginUi_displayPrimaryPaperKey_rpc = {
  method: 'loginUi.displayPrimaryPaperKey',
  param: {
    phrase: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadata_Time = long

export type metadata_StringKVPair = {
  key: string;
  value: string;
}

export type metadata_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type metadata_UID = string

export type metadata_DeviceID = string

export type metadata_SigID = string

export type metadata_KID = string

export type metadata_Text = {
  data: string;
  markup: boolean;
}

export type metadata_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type metadata_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type metadata_User = {
  uid: UID;
  username: string;
}

export type metadata_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type metadata_Stream = {
  fd: int;
}

export type metadata_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type metadata_ClientType = 2 /* FORCE GUI ONLY */

export type metadata_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type metadata_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type metadata_BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type metadata_ChallengeInfo = {
  now: long;
  challenge: string;
}

export type metadata_KeyHalf = {
  user: UID;
  deviceKID: KID;
  key: bytes;
}

export type KeyHalf = {
  user: UID;
  deviceKID: KID;
  key: bytes;
}

export type metadata_MDBlock = {
  version: int;
  block: bytes;
}

export type MDBlock = {
  version: int;
  block: bytes;
}

export type metadata_MetadataResponse = {
  folderID: string;
  mdBlocks: Array<MDBlock>;
}

export type MetadataResponse = {
  folderID: string;
  mdBlocks: Array<MDBlock>;
}

// metadata.getChallenge ////////////////////////////////////////

export type metadata_getChallenge_result = metadata_ChallengeInfo

export type metadata_getChallenge_rpc = {
  method: 'metadata.getChallenge',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getChallenge_result) => void)
}

// metadata.authenticate ////////////////////////////////////////

export type metadata_authenticate_result = int

export type metadata_authenticate_rpc = {
  method: 'metadata.authenticate',
  param: {
    signature: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_authenticate_result) => void)
}

// metadata.putMetadata ////////////////////////////////////////

/* void response */

export type metadata_putMetadata_rpc = {
  method: 'metadata.putMetadata',
  param: {
    mdBlock: metadata_MDBlock,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadata.getMetadata ////////////////////////////////////////

export type metadata_getMetadata_result = metadata_MetadataResponse

export type metadata_getMetadata_rpc = {
  method: 'metadata.getMetadata',
  param: {
    folderID: string,
    folderHandle: bytes,
    branchID: string,
    unmerged: boolean,
    startRevision: long,
    stopRevision: long,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getMetadata_result) => void)
}

// metadata.registerForUpdates ////////////////////////////////////////

/* void response */

export type metadata_registerForUpdates_rpc = {
  method: 'metadata.registerForUpdates',
  param: {
    folderID: string,
    currRevision: long,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadata.pruneBranch ////////////////////////////////////////

/* void response */

export type metadata_pruneBranch_rpc = {
  method: 'metadata.pruneBranch',
  param: {
    folderID: string,
    branchID: string,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadata.putKeys ////////////////////////////////////////

/* void response */

export type metadata_putKeys_rpc = {
  method: 'metadata.putKeys',
  param: {
    keyHalves: Array<metadata_KeyHalf>,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadata.getKey ////////////////////////////////////////

export type metadata_getKey_result = bytes

export type metadata_getKey_rpc = {
  method: 'metadata.getKey',
  param: {
    keyHalfID: bytes,
    deviceKID: string,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getKey_result) => void)
}

// metadata.deleteKey ////////////////////////////////////////

/* void response */

export type metadata_deleteKey_rpc = {
  method: 'metadata.deleteKey',
  param: {
    uid: metadata_UID,
    deviceKID: metadata_KID,
    keyHalfID: bytes,
    logTags: {string: string}
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadata.truncateLock ////////////////////////////////////////

export type metadata_truncateLock_result = boolean

export type metadata_truncateLock_rpc = {
  method: 'metadata.truncateLock',
  param: {
    folderID: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_truncateLock_result) => void)
}

// metadata.truncateUnlock ////////////////////////////////////////

export type metadata_truncateUnlock_result = boolean

export type metadata_truncateUnlock_rpc = {
  method: 'metadata.truncateUnlock',
  param: {
    folderID: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_truncateUnlock_result) => void)
}

// metadata.getFolderHandle ////////////////////////////////////////

export type metadata_getFolderHandle_result = bytes

export type metadata_getFolderHandle_rpc = {
  method: 'metadata.getFolderHandle',
  param: {
    folderID: string,
    signature: string,
    challenge: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: metadata_getFolderHandle_result) => void)
}

// metadata.getFoldersForRekey ////////////////////////////////////////

/* void response */

export type metadata_getFoldersForRekey_rpc = {
  method: 'metadata.getFoldersForRekey',
  param: {
    deviceKID: metadata_KID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadata.ping ////////////////////////////////////////

/* void response */

export type metadata_ping_rpc = {
  method: 'metadata.ping',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type metadataUpdate_Time = long

export type metadataUpdate_StringKVPair = {
  key: string;
  value: string;
}

export type metadataUpdate_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type metadataUpdate_UID = string

export type metadataUpdate_DeviceID = string

export type metadataUpdate_SigID = string

export type metadataUpdate_KID = string

export type metadataUpdate_Text = {
  data: string;
  markup: boolean;
}

export type metadataUpdate_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type metadataUpdate_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type metadataUpdate_User = {
  uid: UID;
  username: string;
}

export type metadataUpdate_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type metadataUpdate_Stream = {
  fd: int;
}

export type metadataUpdate_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type metadataUpdate_ClientType = 2 /* FORCE GUI ONLY */

export type metadataUpdate_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type metadataUpdate_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type metadataUpdate_BlockIdCombo = {
  blockHash: string;
  chargedTo: UID;
}

export type metadataUpdate_ChallengeInfo = {
  now: long;
  challenge: string;
}

// metadataUpdate.metadataUpdate ////////////////////////////////////////

/* void response */

export type metadataUpdate_metadataUpdate_rpc = {
  method: 'metadataUpdate.metadataUpdate',
  param: {
    folderID: string,
    revision: long
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// metadataUpdate.folderNeedsRekey ////////////////////////////////////////

/* void response */

export type metadataUpdate_folderNeedsRekey_rpc = {
  method: 'metadataUpdate.folderNeedsRekey',
  param: {
    folderID: string,
    revision: long
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type notifyCtl_Time = long

export type notifyCtl_StringKVPair = {
  key: string;
  value: string;
}

export type notifyCtl_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type notifyCtl_UID = string

export type notifyCtl_DeviceID = string

export type notifyCtl_SigID = string

export type notifyCtl_KID = string

export type notifyCtl_Text = {
  data: string;
  markup: boolean;
}

export type notifyCtl_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type notifyCtl_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type notifyCtl_User = {
  uid: UID;
  username: string;
}

export type notifyCtl_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type notifyCtl_Stream = {
  fd: int;
}

export type notifyCtl_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type notifyCtl_ClientType = 2 /* FORCE GUI ONLY */

export type notifyCtl_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type notifyCtl_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type notifyCtl_NotificationChannels = {
  session: boolean;
  users: boolean;
  kbfs: boolean;
  tracking: boolean;
}

export type NotificationChannels = {
  session: boolean;
  users: boolean;
  kbfs: boolean;
  tracking: boolean;
}

// notifyCtl.setNotifications ////////////////////////////////////////

/* void response */

export type notifyCtl_setNotifications_rpc = {
  method: 'notifyCtl.setNotifications',
  param: {
    channels: notifyCtl_NotificationChannels
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifyFS_FSStatusCode = 0 /* 'START_0' */ | 1 /* 'FINISH_1' */ | 2 /* 'ERROR_2' */

export type NotifyFS_FSNotificationType = 0 /* 'ENCRYPTING_0' */ | 1 /* 'DECRYPTING_1' */ | 2 /* 'SIGNING_2' */ | 3 /* 'VERIFYING_3' */ | 4 /* 'REKEYING_4' */

export type NotifyFS_FSNotification = {
  publicTopLevelFolder: boolean;
  filename: string;
  status: string;
  statusCode: FSStatusCode;
  notificationType: FSNotificationType;
}

// NotifyFS.FSActivity ////////////////////////////////////////

/* void response */

export type NotifyFS_FSActivity_rpc = {
  method: 'NotifyFS.FSActivity',
  param: {
    notification: NotifyFS_FSNotification
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// NotifySession.loggedOut ////////////////////////////////////////

/* void response */

export type NotifySession_loggedOut_rpc = {
  method: 'NotifySession.loggedOut',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// NotifySession.loggedIn ////////////////////////////////////////

/* void response */

export type NotifySession_loggedIn_rpc = {
  method: 'NotifySession.loggedIn',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifyTracking_Time = long

export type NotifyTracking_StringKVPair = {
  key: string;
  value: string;
}

export type NotifyTracking_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type NotifyTracking_UID = string

export type NotifyTracking_DeviceID = string

export type NotifyTracking_SigID = string

export type NotifyTracking_KID = string

export type NotifyTracking_Text = {
  data: string;
  markup: boolean;
}

export type NotifyTracking_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type NotifyTracking_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type NotifyTracking_User = {
  uid: UID;
  username: string;
}

export type NotifyTracking_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type NotifyTracking_Stream = {
  fd: int;
}

export type NotifyTracking_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type NotifyTracking_ClientType = 2 /* FORCE GUI ONLY */

export type NotifyTracking_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type NotifyTracking_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// NotifyTracking.trackingChanged ////////////////////////////////////////

/* void response */

export type NotifyTracking_trackingChanged_rpc = {
  method: 'NotifyTracking.trackingChanged',
  param: {
    uid: NotifyTracking_UID,
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type NotifyUsers_Time = long

export type NotifyUsers_StringKVPair = {
  key: string;
  value: string;
}

export type NotifyUsers_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type NotifyUsers_UID = string

export type NotifyUsers_DeviceID = string

export type NotifyUsers_SigID = string

export type NotifyUsers_KID = string

export type NotifyUsers_Text = {
  data: string;
  markup: boolean;
}

export type NotifyUsers_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type NotifyUsers_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type NotifyUsers_User = {
  uid: UID;
  username: string;
}

export type NotifyUsers_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type NotifyUsers_Stream = {
  fd: int;
}

export type NotifyUsers_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type NotifyUsers_ClientType = 2 /* FORCE GUI ONLY */

export type NotifyUsers_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type NotifyUsers_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// NotifyUsers.userChanged ////////////////////////////////////////

/* void response */

export type NotifyUsers_userChanged_rpc = {
  method: 'NotifyUsers.userChanged',
  param: {
    uid: NotifyUsers_UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgp_Time = long

export type pgp_StringKVPair = {
  key: string;
  value: string;
}

export type pgp_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type pgp_UID = string

export type pgp_DeviceID = string

export type pgp_SigID = string

export type pgp_KID = string

export type pgp_Text = {
  data: string;
  markup: boolean;
}

export type pgp_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type pgp_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type pgp_User = {
  uid: UID;
  username: string;
}

export type pgp_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type pgp_Stream = {
  fd: int;
}

export type pgp_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type pgp_ClientType = 2 /* FORCE GUI ONLY */

export type pgp_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type pgp_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type pgp_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type pgp_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type pgp_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type pgp_TrackToken = string

export type pgp_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type pgp_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type pgp_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type pgp_TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type pgp_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type pgp_IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type pgp_IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type pgp_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type pgp_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type pgp_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type pgp_SignMode = 0 /* 'ATTACHED_0' */ | 1 /* 'DETACHED_1' */ | 2 /* 'CLEAR_2' */

export type SignMode = 0 /* 'ATTACHED_0' */ | 1 /* 'DETACHED_1' */ | 2 /* 'CLEAR_2' */

export type pgp_PGPSignOptions = {
  keyQuery: string;
  mode: SignMode;
  binaryIn: boolean;
  binaryOut: boolean;
}

export type PGPSignOptions = {
  keyQuery: string;
  mode: SignMode;
  binaryIn: boolean;
  binaryOut: boolean;
}

export type pgp_PGPEncryptOptions = {
  recipients: Array<string>;
  noSign: boolean;
  noSelf: boolean;
  binaryOut: boolean;
  keyQuery: string;
  skipTrack: boolean;
  trackOptions: TrackOptions;
}

export type PGPEncryptOptions = {
  recipients: Array<string>;
  noSign: boolean;
  noSelf: boolean;
  binaryOut: boolean;
  keyQuery: string;
  skipTrack: boolean;
  trackOptions: TrackOptions;
}

export type pgp_PGPSigVerification = {
  isSigned: boolean;
  verified: boolean;
  signer: User;
  signKey: PublicKey;
}

export type PGPSigVerification = {
  isSigned: boolean;
  verified: boolean;
  signer: User;
  signKey: PublicKey;
}

export type pgp_PGPDecryptOptions = {
  assertSigned: boolean;
  signedBy: string;
}

export type PGPDecryptOptions = {
  assertSigned: boolean;
  signedBy: string;
}

export type pgp_PGPVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type PGPVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type pgp_KeyInfo = {
  fingerprint: string;
  key: string;
  desc: string;
}

export type KeyInfo = {
  fingerprint: string;
  key: string;
  desc: string;
}

export type pgp_PGPQuery = {
  secret: boolean;
  query: string;
  exactMatch: boolean;
}

export type PGPQuery = {
  secret: boolean;
  query: string;
  exactMatch: boolean;
}

export type pgp_PGPCreateUids = {
  useDefault: boolean;
  ids: Array<PGPIdentity>;
}

export type PGPCreateUids = {
  useDefault: boolean;
  ids: Array<PGPIdentity>;
}

// pgp.pgpSign ////////////////////////////////////////

/* void response */

export type pgp_pgpSign_rpc = {
  method: 'pgp.pgpSign',
  param: {
    source: pgp_Stream,
    sink: pgp_Stream,
    opts: pgp_PGPSignOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpPull ////////////////////////////////////////

/* void response */

export type pgp_pgpPull_rpc = {
  method: 'pgp.pgpPull',
  param: {
    userAsserts: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpEncrypt ////////////////////////////////////////

/* void response */

export type pgp_pgpEncrypt_rpc = {
  method: 'pgp.pgpEncrypt',
  param: {
    source: pgp_Stream,
    sink: pgp_Stream,
    opts: pgp_PGPEncryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpDecrypt ////////////////////////////////////////

export type pgp_pgpDecrypt_result = pgp_PGPSigVerification

export type pgp_pgpDecrypt_rpc = {
  method: 'pgp.pgpDecrypt',
  param: {
    source: pgp_Stream,
    sink: pgp_Stream,
    opts: pgp_PGPDecryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpDecrypt_result) => void)
}

// pgp.pgpVerify ////////////////////////////////////////

export type pgp_pgpVerify_result = pgp_PGPSigVerification

export type pgp_pgpVerify_rpc = {
  method: 'pgp.pgpVerify',
  param: {
    source: pgp_Stream,
    opts: pgp_PGPVerifyOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpVerify_result) => void)
}

// pgp.pgpImport ////////////////////////////////////////

/* void response */

export type pgp_pgpImport_rpc = {
  method: 'pgp.pgpImport',
  param: {
    key: bytes,
    pushSecret: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpExport ////////////////////////////////////////

export type pgp_pgpExport_result = Array<pgp_KeyInfo>

export type pgp_pgpExport_rpc = {
  method: 'pgp.pgpExport',
  param: {
    options: pgp_PGPQuery
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpExport_result) => void)
}

// pgp.pgpExportByFingerprint ////////////////////////////////////////

export type pgp_pgpExportByFingerprint_result = Array<pgp_KeyInfo>

export type pgp_pgpExportByFingerprint_rpc = {
  method: 'pgp.pgpExportByFingerprint',
  param: {
    options: pgp_PGPQuery
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpExportByFingerprint_result) => void)
}

// pgp.pgpExportByKID ////////////////////////////////////////

export type pgp_pgpExportByKID_result = Array<pgp_KeyInfo>

export type pgp_pgpExportByKID_rpc = {
  method: 'pgp.pgpExportByKID',
  param: {
    options: pgp_PGPQuery
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: pgp_pgpExportByKID_result) => void)
}

// pgp.pgpKeyGen ////////////////////////////////////////

/* void response */

export type pgp_pgpKeyGen_rpc = {
  method: 'pgp.pgpKeyGen',
  param: {
    primaryBits: int,
    subkeyBits: int,
    createUids: pgp_PGPCreateUids,
    allowMulti: boolean,
    doExport: boolean,
    pushSecret: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpDeletePrimary ////////////////////////////////////////

/* void response */

export type pgp_pgpDeletePrimary_rpc = {
  method: 'pgp.pgpDeletePrimary',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpSelect ////////////////////////////////////////

/* void response */

export type pgp_pgpSelect_rpc = {
  method: 'pgp.pgpSelect',
  param: {
    fingerprintQuery: string,
    allowMulti: boolean,
    skipImport: boolean,
    onlyImport: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// pgp.pgpUpdate ////////////////////////////////////////

/* void response */

export type pgp_pgpUpdate_rpc = {
  method: 'pgp.pgpUpdate',
  param: {
    all: boolean,
    fingerprints: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type pgpUi_Time = long

export type pgpUi_StringKVPair = {
  key: string;
  value: string;
}

export type pgpUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type pgpUi_UID = string

export type pgpUi_DeviceID = string

export type pgpUi_SigID = string

export type pgpUi_KID = string

export type pgpUi_Text = {
  data: string;
  markup: boolean;
}

export type pgpUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type pgpUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type pgpUi_User = {
  uid: UID;
  username: string;
}

export type pgpUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type pgpUi_Stream = {
  fd: int;
}

export type pgpUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type pgpUi_ClientType = 2 /* FORCE GUI ONLY */

export type pgpUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type pgpUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// pgpUi.outputSignatureSuccess ////////////////////////////////////////

/* void response */

export type pgpUi_outputSignatureSuccess_rpc = {
  method: 'pgpUi.outputSignatureSuccess',
  param: {
    fingerprint: string,
    username: string,
    signedAt: pgpUi_Time
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type prove_Time = long

export type prove_StringKVPair = {
  key: string;
  value: string;
}

export type prove_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type prove_UID = string

export type prove_DeviceID = string

export type prove_SigID = string

export type prove_KID = string

export type prove_Text = {
  data: string;
  markup: boolean;
}

export type prove_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type prove_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type prove_User = {
  uid: UID;
  username: string;
}

export type prove_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type prove_Stream = {
  fd: int;
}

export type prove_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type prove_ClientType = 2 /* FORCE GUI ONLY */

export type prove_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type prove_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type prove_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type prove_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type prove_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type prove_TrackToken = string

export type prove_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type prove_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type prove_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type prove_TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type prove_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type prove_IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type prove_IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type prove_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type prove_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type prove_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type prove_CheckProofStatus = {
  found: boolean;
  status: ProofStatus;
  proofText: string;
}

export type CheckProofStatus = {
  found: boolean;
  status: ProofStatus;
  proofText: string;
}

export type prove_StartProofResult = {
  sigID: SigID;
}

export type StartProofResult = {
  sigID: SigID;
}

// prove.startProof ////////////////////////////////////////

export type prove_startProof_result = prove_StartProofResult

export type prove_startProof_rpc = {
  method: 'prove.startProof',
  param: {
    service: string,
    username: string,
    force: boolean,
    promptPosted: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: prove_startProof_result) => void)
}

// prove.checkProof ////////////////////////////////////////

export type prove_checkProof_result = prove_CheckProofStatus

export type prove_checkProof_rpc = {
  method: 'prove.checkProof',
  param: {
    sigID: prove_SigID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: prove_checkProof_result) => void)
}

export type proveUi_Time = long

export type proveUi_StringKVPair = {
  key: string;
  value: string;
}

export type proveUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type proveUi_UID = string

export type proveUi_DeviceID = string

export type proveUi_SigID = string

export type proveUi_KID = string

export type proveUi_Text = {
  data: string;
  markup: boolean;
}

export type proveUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type proveUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type proveUi_User = {
  uid: UID;
  username: string;
}

export type proveUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type proveUi_Stream = {
  fd: int;
}

export type proveUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type proveUi_ClientType = 2 /* FORCE GUI ONLY */

export type proveUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type proveUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type proveUi_PromptOverwriteType = 0 /* 'SOCIAL_0' */ | 1 /* 'SITE_1' */

export type PromptOverwriteType = 0 /* 'SOCIAL_0' */ | 1 /* 'SITE_1' */

// proveUi.promptOverwrite ////////////////////////////////////////

export type proveUi_promptOverwrite_result = boolean

export type proveUi_promptOverwrite_rpc = {
  method: 'proveUi.promptOverwrite',
  param: {
    account: string,
    typ: proveUi_PromptOverwriteType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_promptOverwrite_result) => void)
}

// proveUi.promptUsername ////////////////////////////////////////

export type proveUi_promptUsername_result = string

export type proveUi_promptUsername_rpc = {
  method: 'proveUi.promptUsername',
  param: {
    prompt: string,
    prevError: (null | Status)
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_promptUsername_result) => void)
}

// proveUi.outputPrechecks ////////////////////////////////////////

/* void response */

export type proveUi_outputPrechecks_rpc = {
  method: 'proveUi.outputPrechecks',
  param: {
    text: proveUi_Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// proveUi.preProofWarning ////////////////////////////////////////

export type proveUi_preProofWarning_result = boolean

export type proveUi_preProofWarning_rpc = {
  method: 'proveUi.preProofWarning',
  param: {
    text: proveUi_Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_preProofWarning_result) => void)
}

// proveUi.outputInstructions ////////////////////////////////////////

/* void response */

export type proveUi_outputInstructions_rpc = {
  method: 'proveUi.outputInstructions',
  param: {
    instructions: proveUi_Text,
    proof: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// proveUi.okToCheck ////////////////////////////////////////

export type proveUi_okToCheck_result = boolean

export type proveUi_okToCheck_rpc = {
  method: 'proveUi.okToCheck',
  param: {
    name: string,
    attempt: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: proveUi_okToCheck_result) => void)
}

// proveUi.displayRecheckWarning ////////////////////////////////////////

/* void response */

export type proveUi_displayRecheckWarning_rpc = {
  method: 'proveUi.displayRecheckWarning',
  param: {
    text: proveUi_Text
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type provisionUi_Time = long

export type provisionUi_StringKVPair = {
  key: string;
  value: string;
}

export type provisionUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type provisionUi_UID = string

export type provisionUi_DeviceID = string

export type provisionUi_SigID = string

export type provisionUi_KID = string

export type provisionUi_Text = {
  data: string;
  markup: boolean;
}

export type provisionUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type provisionUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type provisionUi_User = {
  uid: UID;
  username: string;
}

export type provisionUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type provisionUi_Stream = {
  fd: int;
}

export type provisionUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type provisionUi_ClientType = 2 /* FORCE GUI ONLY */

export type provisionUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type provisionUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type provisionUi_ProvisionMethod = 0 /* 'DEVICE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASSPHRASE_2' */ | 3 /* 'GPG_IMPORT_3' */ | 4 /* 'GPG_SIGN_4' */

export type ProvisionMethod = 0 /* 'DEVICE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASSPHRASE_2' */ | 3 /* 'GPG_IMPORT_3' */ | 4 /* 'GPG_SIGN_4' */

export type provisionUi_DeviceType = 0 /* 'DESKTOP_0' */ | 1 /* 'MOBILE_1' */

export type DeviceType = 0 /* 'DESKTOP_0' */ | 1 /* 'MOBILE_1' */

export type provisionUi_ChooseType = 0 /* 'EXISTING_DEVICE_0' */ | 1 /* 'NEW_DEVICE_1' */

export type ChooseType = 0 /* 'EXISTING_DEVICE_0' */ | 1 /* 'NEW_DEVICE_1' */

export type provisionUi_SecretResponse = {
  secret: bytes;
  phrase: string;
}

export type SecretResponse = {
  secret: bytes;
  phrase: string;
}

// provisionUi.chooseProvisioningMethod ////////////////////////////////////////

export type provisionUi_chooseProvisioningMethod_result = provisionUi_ProvisionMethod

export type provisionUi_chooseProvisioningMethod_rpc = {
  method: 'provisionUi.chooseProvisioningMethod',
  param: {
    gpgOption: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_chooseProvisioningMethod_result) => void)
}

// provisionUi.chooseDeviceType ////////////////////////////////////////

export type provisionUi_chooseDeviceType_result = provisionUi_DeviceType

export type provisionUi_chooseDeviceType_rpc = {
  method: 'provisionUi.chooseDeviceType',
  param: {
    kind: provisionUi_ChooseType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_chooseDeviceType_result) => void)
}

// provisionUi.DisplayAndPromptSecret ////////////////////////////////////////

export type provisionUi_DisplayAndPromptSecret_result = provisionUi_SecretResponse

export type provisionUi_DisplayAndPromptSecret_rpc = {
  method: 'provisionUi.DisplayAndPromptSecret',
  param: {
    secret: bytes,
    phrase: string,
    otherDeviceType: provisionUi_DeviceType
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_DisplayAndPromptSecret_result) => void)
}

// provisionUi.DisplaySecretExchanged ////////////////////////////////////////

/* void response */

export type provisionUi_DisplaySecretExchanged_rpc = {
  method: 'provisionUi.DisplaySecretExchanged',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// provisionUi.PromptNewDeviceName ////////////////////////////////////////

export type provisionUi_PromptNewDeviceName_result = string

export type provisionUi_PromptNewDeviceName_rpc = {
  method: 'provisionUi.PromptNewDeviceName',
  param: {
    existingDevices: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: provisionUi_PromptNewDeviceName_result) => void)
}

// provisionUi.ProvisioneeSuccess ////////////////////////////////////////

/* void response */

export type provisionUi_ProvisioneeSuccess_rpc = {
  method: 'provisionUi.ProvisioneeSuccess',
  param: {
    username: string,
    deviceName: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// provisionUi.ProvisionerSuccess ////////////////////////////////////////

/* void response */

export type provisionUi_ProvisionerSuccess_rpc = {
  method: 'provisionUi.ProvisionerSuccess',
  param: {
    deviceName: string,
    deviceType: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type quota_Time = long

export type quota_StringKVPair = {
  key: string;
  value: string;
}

export type quota_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type quota_UID = string

export type quota_DeviceID = string

export type quota_SigID = string

export type quota_KID = string

export type quota_Text = {
  data: string;
  markup: boolean;
}

export type quota_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type quota_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type quota_User = {
  uid: UID;
  username: string;
}

export type quota_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type quota_Stream = {
  fd: int;
}

export type quota_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type quota_ClientType = 2 /* FORCE GUI ONLY */

export type quota_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type quota_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type quota_VerifySessionRes = {
  uid: UID;
  sid: string;
  generated: int;
  lifetime: int;
}

export type VerifySessionRes = {
  uid: UID;
  sid: string;
  generated: int;
  lifetime: int;
}

// quota.verifySession ////////////////////////////////////////

export type quota_verifySession_result = quota_VerifySessionRes

export type quota_verifySession_rpc = {
  method: 'quota.verifySession',
  param: {
    session: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: quota_verifySession_result) => void)
}

export type revoke_Time = long

export type revoke_StringKVPair = {
  key: string;
  value: string;
}

export type revoke_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type revoke_UID = string

export type revoke_DeviceID = string

export type revoke_SigID = string

export type revoke_KID = string

export type revoke_Text = {
  data: string;
  markup: boolean;
}

export type revoke_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type revoke_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type revoke_User = {
  uid: UID;
  username: string;
}

export type revoke_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type revoke_Stream = {
  fd: int;
}

export type revoke_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type revoke_ClientType = 2 /* FORCE GUI ONLY */

export type revoke_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type revoke_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// revoke.revokeKey ////////////////////////////////////////

/* void response */

export type revoke_revokeKey_rpc = {
  method: 'revoke.revokeKey',
  param: {
    keyID: revoke_KID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// revoke.revokeDevice ////////////////////////////////////////

/* void response */

export type revoke_revokeDevice_rpc = {
  method: 'revoke.revokeDevice',
  param: {
    deviceID: revoke_DeviceID,
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// revoke.revokeSigs ////////////////////////////////////////

/* void response */

export type revoke_revokeSigs_rpc = {
  method: 'revoke.revokeSigs',
  param: {
    sigIDQueries: Array<string>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpack_Time = long

export type saltpack_StringKVPair = {
  key: string;
  value: string;
}

export type saltpack_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type saltpack_UID = string

export type saltpack_DeviceID = string

export type saltpack_SigID = string

export type saltpack_KID = string

export type saltpack_Text = {
  data: string;
  markup: boolean;
}

export type saltpack_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type saltpack_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type saltpack_User = {
  uid: UID;
  username: string;
}

export type saltpack_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type saltpack_Stream = {
  fd: int;
}

export type saltpack_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type saltpack_ClientType = 2 /* FORCE GUI ONLY */

export type saltpack_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type saltpack_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type saltpack_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type saltpack_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type saltpack_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type saltpack_TrackToken = string

export type saltpack_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type saltpack_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type saltpack_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type saltpack_TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type saltpack_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type saltpack_IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type saltpack_IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type saltpack_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type saltpack_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type saltpack_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

export type saltpack_SaltpackEncryptOptions = {
  recipients: Array<string>;
  hideSelf: boolean;
  noSelfEncrypt: boolean;
  binary: boolean;
}

export type SaltpackEncryptOptions = {
  recipients: Array<string>;
  hideSelf: boolean;
  noSelfEncrypt: boolean;
  binary: boolean;
}

export type saltpack_SaltpackDecryptOptions = {
  interactive: boolean;
  forceRemoteCheck: boolean;
}

export type SaltpackDecryptOptions = {
  interactive: boolean;
  forceRemoteCheck: boolean;
}

export type saltpack_SaltpackSignOptions = {
  detached: boolean;
  binary: boolean;
}

export type SaltpackSignOptions = {
  detached: boolean;
  binary: boolean;
}

export type saltpack_SaltpackVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type SaltpackVerifyOptions = {
  signedBy: string;
  signature: bytes;
}

export type saltpack_SaltpackEncryptedMessageInfo = {
  devices: Array<Device>;
  numAnonReceivers: int;
  receiverIsAnon: boolean;
}

export type SaltpackEncryptedMessageInfo = {
  devices: Array<Device>;
  numAnonReceivers: int;
  receiverIsAnon: boolean;
}

// saltpack.saltpackEncrypt ////////////////////////////////////////

/* void response */

export type saltpack_saltpackEncrypt_rpc = {
  method: 'saltpack.saltpackEncrypt',
  param: {
    source: saltpack_Stream,
    sink: saltpack_Stream,
    opts: saltpack_SaltpackEncryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// saltpack.saltpackDecrypt ////////////////////////////////////////

export type saltpack_saltpackDecrypt_result = saltpack_SaltpackEncryptedMessageInfo

export type saltpack_saltpackDecrypt_rpc = {
  method: 'saltpack.saltpackDecrypt',
  param: {
    source: saltpack_Stream,
    sink: saltpack_Stream,
    opts: saltpack_SaltpackDecryptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: saltpack_saltpackDecrypt_result) => void)
}

// saltpack.saltpackSign ////////////////////////////////////////

/* void response */

export type saltpack_saltpackSign_rpc = {
  method: 'saltpack.saltpackSign',
  param: {
    source: saltpack_Stream,
    sink: saltpack_Stream,
    opts: saltpack_SaltpackSignOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// saltpack.saltpackVerify ////////////////////////////////////////

/* void response */

export type saltpack_saltpackVerify_rpc = {
  method: 'saltpack.saltpackVerify',
  param: {
    source: saltpack_Stream,
    sink: saltpack_Stream,
    opts: saltpack_SaltpackVerifyOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type saltpackUi_Time = long

export type saltpackUi_StringKVPair = {
  key: string;
  value: string;
}

export type saltpackUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type saltpackUi_UID = string

export type saltpackUi_DeviceID = string

export type saltpackUi_SigID = string

export type saltpackUi_KID = string

export type saltpackUi_Text = {
  data: string;
  markup: boolean;
}

export type saltpackUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type saltpackUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type saltpackUi_User = {
  uid: UID;
  username: string;
}

export type saltpackUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type saltpackUi_Stream = {
  fd: int;
}

export type saltpackUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type saltpackUi_ClientType = 2 /* FORCE GUI ONLY */

export type saltpackUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type saltpackUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type saltpackUi_SaltpackSenderType = 0 /* 'NOT_TRACKED_0' */ | 1 /* 'UNKNOWN_1' */ | 2 /* 'ANONYMOUS_2' */ | 3 /* 'TRACKING_BROKE_3' */ | 4 /* 'TRACKING_OK_4' */ | 5 /* 'SELF_5' */

export type SaltpackSenderType = 0 /* 'NOT_TRACKED_0' */ | 1 /* 'UNKNOWN_1' */ | 2 /* 'ANONYMOUS_2' */ | 3 /* 'TRACKING_BROKE_3' */ | 4 /* 'TRACKING_OK_4' */ | 5 /* 'SELF_5' */

export type saltpackUi_SaltpackSender = {
  uid: UID;
  username: string;
  senderType: SaltpackSenderType;
}

export type SaltpackSender = {
  uid: UID;
  username: string;
  senderType: SaltpackSenderType;
}

// saltpackUi.saltpackPromptForDecrypt ////////////////////////////////////////

/* void response */

export type saltpackUi_saltpackPromptForDecrypt_rpc = {
  method: 'saltpackUi.saltpackPromptForDecrypt',
  param: {
    sender: saltpackUi_SaltpackSender
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// saltpackUi.saltpackVerifySuccess ////////////////////////////////////////

/* void response */

export type saltpackUi_saltpackVerifySuccess_rpc = {
  method: 'saltpackUi.saltpackVerifySuccess',
  param: {
    signingKID: saltpackUi_KID,
    sender: saltpackUi_SaltpackSender
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type secretUi_Feature = {
  allow: boolean;
  defaultValue: boolean;
  readonly: boolean;
  label: string;
}

export type secretUi_GUIEntryFeatures = {
  storeSecret: Feature;
  showTyping: Feature;
}

export type secretUi_PassphraseType = 0 /* 'NONE_0' */ | 1 /* 'PAPER_KEY_1' */ | 2 /* 'PASS_PHRASE_2' */ | 3 /* 'VERIFY_PASS_PHRASE_3' */

export type secretUi_GUIEntryArg = {
  windowTitle: string;
  prompt: string;
  submitLabel: string;
  cancelLabel: string;
  retryLabel: string;
  type: PassphraseType;
  features: GUIEntryFeatures;
}

export type secretUi_GetPassphraseRes = {
  passphrase: string;
  storeSecret: boolean;
}

export type secretUi_SecretEntryArg = {
  desc: string;
  prompt: string;
  err: string;
  cancel: string;
  ok: string;
  reason: string;
  useSecretStore: boolean;
}

export type SecretEntryArg = {
  desc: string;
  prompt: string;
  err: string;
  cancel: string;
  ok: string;
  reason: string;
  useSecretStore: boolean;
}

export type secretUi_SecretEntryRes = {
  text: string;
  canceled: boolean;
  storeSecret: boolean;
}

export type SecretEntryRes = {
  text: string;
  canceled: boolean;
  storeSecret: boolean;
}

// secretUi.getPassphrase ////////////////////////////////////////

export type secretUi_getPassphrase_result = secretUi_GetPassphraseRes

export type secretUi_getPassphrase_rpc = {
  method: 'secretUi.getPassphrase',
  param: {
    pinentry: secretUi_GUIEntryArg,
    terminal: (null | SecretEntryArg)
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: secretUi_getPassphrase_result) => void)
}

export type SecretKeys_Time = long

export type SecretKeys_StringKVPair = {
  key: string;
  value: string;
}

export type SecretKeys_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type SecretKeys_UID = string

export type SecretKeys_DeviceID = string

export type SecretKeys_SigID = string

export type SecretKeys_KID = string

export type SecretKeys_Text = {
  data: string;
  markup: boolean;
}

export type SecretKeys_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type SecretKeys_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type SecretKeys_User = {
  uid: UID;
  username: string;
}

export type SecretKeys_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type SecretKeys_Stream = {
  fd: int;
}

export type SecretKeys_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type SecretKeys_ClientType = 2 /* FORCE GUI ONLY */

export type SecretKeys_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type SecretKeys_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type SecretKeys_NaclSigningKeyPublic = any

export type NaclSigningKeyPublic = any

export type SecretKeys_NaclSigningKeyPrivate = any

export type NaclSigningKeyPrivate = any

export type SecretKeys_NaclDHKeyPublic = any

export type NaclDHKeyPublic = any

export type SecretKeys_NaclDHKeyPrivate = any

export type NaclDHKeyPrivate = any

export type SecretKeys_SecretKeys = {
  signing: NaclSigningKeyPrivate;
  encryption: NaclDHKeyPrivate;
}

export type SecretKeys = {
  signing: NaclSigningKeyPrivate;
  encryption: NaclDHKeyPrivate;
}

// SecretKeys.getSecretKeys ////////////////////////////////////////

export type SecretKeys_getSecretKeys_result = SecretKeys_SecretKeys

export type SecretKeys_getSecretKeys_rpc = {
  method: 'SecretKeys.getSecretKeys',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: SecretKeys_getSecretKeys_result) => void)
}

export type session_Time = long

export type session_StringKVPair = {
  key: string;
  value: string;
}

export type session_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type session_UID = string

export type session_DeviceID = string

export type session_SigID = string

export type session_KID = string

export type session_Text = {
  data: string;
  markup: boolean;
}

export type session_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type session_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type session_User = {
  uid: UID;
  username: string;
}

export type session_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type session_Stream = {
  fd: int;
}

export type session_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type session_ClientType = 2 /* FORCE GUI ONLY */

export type session_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type session_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type session_Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
  deviceSibkeyKid: KID;
}

export type Session = {
  uid: UID;
  username: string;
  token: string;
  deviceSubkeyKid: KID;
  deviceSibkeyKid: KID;
}

// session.currentSession ////////////////////////////////////////

export type session_currentSession_result = session_Session

export type session_currentSession_rpc = {
  method: 'session.currentSession',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: session_currentSession_result) => void)
}

export type signup_Time = long

export type signup_StringKVPair = {
  key: string;
  value: string;
}

export type signup_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type signup_UID = string

export type signup_DeviceID = string

export type signup_SigID = string

export type signup_KID = string

export type signup_Text = {
  data: string;
  markup: boolean;
}

export type signup_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type signup_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type signup_User = {
  uid: UID;
  username: string;
}

export type signup_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type signup_Stream = {
  fd: int;
}

export type signup_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type signup_ClientType = 2 /* FORCE GUI ONLY */

export type signup_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type signup_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type signup_SignupRes = {
  passphraseOk: boolean;
  postOk: boolean;
  writeOk: boolean;
}

export type SignupRes = {
  passphraseOk: boolean;
  postOk: boolean;
  writeOk: boolean;
}

// signup.checkUsernameAvailable ////////////////////////////////////////

/* void response */

export type signup_checkUsernameAvailable_rpc = {
  method: 'signup.checkUsernameAvailable',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// signup.signup ////////////////////////////////////////

export type signup_signup_result = signup_SignupRes

export type signup_signup_rpc = {
  method: 'signup.signup',
  param: {
    email: string,
    inviteCode: string,
    passphrase: string,
    username: string,
    deviceName: string,
    storeSecret: boolean,
    skipMail: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: signup_signup_result) => void)
}

// signup.inviteRequest ////////////////////////////////////////

/* void response */

export type signup_inviteRequest_rpc = {
  method: 'signup.inviteRequest',
  param: {
    email: string,
    fullname: string,
    notes: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type sigs_Time = long

export type sigs_StringKVPair = {
  key: string;
  value: string;
}

export type sigs_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type sigs_UID = string

export type sigs_DeviceID = string

export type sigs_SigID = string

export type sigs_KID = string

export type sigs_Text = {
  data: string;
  markup: boolean;
}

export type sigs_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type sigs_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type sigs_User = {
  uid: UID;
  username: string;
}

export type sigs_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type sigs_Stream = {
  fd: int;
}

export type sigs_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type sigs_ClientType = 2 /* FORCE GUI ONLY */

export type sigs_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type sigs_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type sigs_Sig = {
  seqno: int;
  sigID: SigID;
  sigIDDisplay: string;
  type: string;
  cTime: Time;
  revoked: boolean;
  active: boolean;
  key: string;
  body: string;
}

export type Sig = {
  seqno: int;
  sigID: SigID;
  sigIDDisplay: string;
  type: string;
  cTime: Time;
  revoked: boolean;
  active: boolean;
  key: string;
  body: string;
}

export type sigs_SigTypes = {
  track: boolean;
  proof: boolean;
  cryptocurrency: boolean;
  isSelf: boolean;
}

export type SigTypes = {
  track: boolean;
  proof: boolean;
  cryptocurrency: boolean;
  isSelf: boolean;
}

export type sigs_SigListArgs = {
  sessionID: int;
  username: string;
  allKeys: boolean;
  types?: ?SigTypes;
  filterx: string;
  verbose: boolean;
  revoked: boolean;
}

export type SigListArgs = {
  sessionID: int;
  username: string;
  allKeys: boolean;
  types?: ?SigTypes;
  filterx: string;
  verbose: boolean;
  revoked: boolean;
}

// sigs.sigList ////////////////////////////////////////

export type sigs_sigList_result = Array<sigs_Sig>

export type sigs_sigList_rpc = {
  method: 'sigs.sigList',
  param: {
    arg: sigs_SigListArgs
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: sigs_sigList_result) => void)
}

// sigs.sigListJSON ////////////////////////////////////////

export type sigs_sigListJSON_result = string

export type sigs_sigListJSON_rpc = {
  method: 'sigs.sigListJSON',
  param: {
    arg: sigs_SigListArgs
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: sigs_sigListJSON_result) => void)
}

export type streamUi_Time = long

export type streamUi_StringKVPair = {
  key: string;
  value: string;
}

export type streamUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type streamUi_UID = string

export type streamUi_DeviceID = string

export type streamUi_SigID = string

export type streamUi_KID = string

export type streamUi_Text = {
  data: string;
  markup: boolean;
}

export type streamUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type streamUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type streamUi_User = {
  uid: UID;
  username: string;
}

export type streamUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type streamUi_Stream = {
  fd: int;
}

export type streamUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type streamUi_ClientType = 2 /* FORCE GUI ONLY */

export type streamUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type streamUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

// streamUi.close ////////////////////////////////////////

/* void response */

export type streamUi_close_rpc = {
  method: 'streamUi.close',
  param: {
    s: streamUi_Stream
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// streamUi.read ////////////////////////////////////////

export type streamUi_read_result = bytes

export type streamUi_read_rpc = {
  method: 'streamUi.read',
  param: {
    s: streamUi_Stream,
    sz: int
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: streamUi_read_result) => void)
}

// streamUi.write ////////////////////////////////////////

export type streamUi_write_result = int

export type streamUi_write_rpc = {
  method: 'streamUi.write',
  param: {
    s: streamUi_Stream,
    buf: bytes
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: streamUi_write_result) => void)
}

export type test_Test = {
  reply: string;
}

export type Test = {
  reply: string;
}

// test.test ////////////////////////////////////////

export type test_test_result = test_Test

export type test_test_rpc = {
  method: 'test.test',
  param: {
    name: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: test_test_result) => void)
}

// test.testCallback ////////////////////////////////////////

export type test_testCallback_result = string

export type test_testCallback_rpc = {
  method: 'test.testCallback',
  param: {
    name: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: test_testCallback_result) => void)
}

// test.panic ////////////////////////////////////////

/* void response */

export type test_panic_rpc = {
  method: 'test.panic',
  param: {
    message: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type track_Time = long

export type track_StringKVPair = {
  key: string;
  value: string;
}

export type track_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type track_UID = string

export type track_DeviceID = string

export type track_SigID = string

export type track_KID = string

export type track_Text = {
  data: string;
  markup: boolean;
}

export type track_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type track_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type track_User = {
  uid: UID;
  username: string;
}

export type track_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type track_Stream = {
  fd: int;
}

export type track_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type track_ClientType = 2 /* FORCE GUI ONLY */

export type track_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type track_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type track_ProofState = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'TEMP_FAILURE_2' */ | 3 /* 'PERM_FAILURE_3' */ | 4 /* 'LOOKING_4' */ | 5 /* 'SUPERSEDED_5' */ | 6 /* 'POSTED_6' */ | 7 /* 'REVOKED_7' */

export type track_ProofStatus = 0 /* 'NONE_0' */ | 1 /* 'OK_1' */ | 2 /* 'LOCAL_2' */ | 3 /* 'FOUND_3' */ | 100 /* 'BASE_ERROR_100' */ | 101 /* 'HOST_UNREACHABLE_101' */ | 103 /* 'PERMISSION_DENIED_103' */ | 106 /* 'FAILED_PARSE_106' */ | 107 /* 'DNS_ERROR_107' */ | 108 /* 'AUTH_FAILED_108' */ | 129 /* 'HTTP_429_129' */ | 150 /* 'HTTP_500_150' */ | 160 /* 'TIMEOUT_160' */ | 170 /* 'INTERNAL_ERROR_170' */ | 200 /* 'BASE_HARD_ERROR_200' */ | 201 /* 'NOT_FOUND_201' */ | 202 /* 'CONTENT_FAILURE_202' */ | 203 /* 'BAD_USERNAME_203' */ | 204 /* 'BAD_REMOTE_ID_204' */ | 205 /* 'TEXT_NOT_FOUND_205' */ | 206 /* 'BAD_ARGS_206' */ | 207 /* 'CONTENT_MISSING_207' */ | 208 /* 'TITLE_NOT_FOUND_208' */ | 209 /* 'SERVICE_ERROR_209' */ | 210 /* 'TOR_SKIPPED_210' */ | 211 /* 'TOR_INCOMPATIBLE_211' */ | 230 /* 'HTTP_300_230' */ | 240 /* 'HTTP_400_240' */ | 260 /* 'HTTP_OTHER_260' */ | 270 /* 'EMPTY_JSON_270' */ | 301 /* 'DELETED_301' */ | 302 /* 'SERVICE_DEAD_302' */ | 303 /* 'BAD_SIGNATURE_303' */ | 304 /* 'BAD_API_URL_304' */ | 305 /* 'UNKNOWN_TYPE_305' */ | 306 /* 'NO_HINT_306' */ | 307 /* 'BAD_HINT_TEXT_307' */

export type track_ProofType = 0 /* 'NONE_0' */ | 1 /* 'KEYBASE_1' */ | 2 /* 'TWITTER_2' */ | 3 /* 'GITHUB_3' */ | 4 /* 'REDDIT_4' */ | 5 /* 'COINBASE_5' */ | 6 /* 'HACKERNEWS_6' */ | 1000 /* 'GENERIC_WEB_SITE_1000' */ | 1001 /* 'DNS_1001' */ | 100001 /* 'ROOTER_100001' */

export type track_TrackToken = string

export type track_TrackDiffType = 0 /* 'NONE_0' */ | 1 /* 'ERROR_1' */ | 2 /* 'CLASH_2' */ | 3 /* 'REVOKED_3' */ | 4 /* 'UPGRADED_4' */ | 5 /* 'NEW_5' */ | 6 /* 'REMOTE_FAIL_6' */ | 7 /* 'REMOTE_WORKING_7' */ | 8 /* 'REMOTE_CHANGED_8' */ | 9 /* 'NEW_ELDEST_9' */

export type track_TrackDiff = {
  type: TrackDiffType;
  displayMarkup: string;
}

export type track_TrackSummary = {
  username: string;
  time: Time;
  isRemote: boolean;
}

export type track_TrackStatus = 1 /* 'NEW_OK_1' */ | 2 /* 'NEW_ZERO_PROOFS_2' */ | 3 /* 'NEW_FAIL_PROOFS_3' */ | 4 /* 'UPDATE_BROKEN_4' */ | 5 /* 'UPDATE_NEW_PROOFS_5' */ | 6 /* 'UPDATE_OK_6' */

export type track_TrackOptions = {
  localOnly: boolean;
  bypassConfirm: boolean;
  forceRetrack: boolean;
}

export type track_IdentifyReasonType = 0 /* 'NONE_0' */ | 1 /* 'ID_1' */ | 2 /* 'TRACK_2' */ | 3 /* 'ENCRYPT_3' */ | 4 /* 'DECRYPT_4' */ | 5 /* 'VERIFY_5' */ | 6 /* 'RESOURCE_6' */

export type track_IdentifyReason = {
  type: IdentifyReasonType;
  reason: string;
  resource: string;
}

export type track_IdentifyOutcome = {
  username: string;
  status?: ?Status;
  warnings: Array<string>;
  trackUsed?: ?TrackSummary;
  trackStatus: TrackStatus;
  numTrackFailures: int;
  numTrackChanges: int;
  numProofFailures: int;
  numRevoked: int;
  numProofSuccesses: int;
  revoked: Array<TrackDiff>;
  trackOptions: TrackOptions;
  forPGPPull: boolean;
  reason: IdentifyReason;
}

export type track_IdentifyRes = {
  user?: ?User;
  publicKeys: Array<PublicKey>;
  outcome: IdentifyOutcome;
  trackToken: TrackToken;
}

export type track_RemoteProof = {
  proofType: ProofType;
  key: string;
  value: string;
  displayMarkup: string;
  sigID: SigID;
  mTime: Time;
}

// track.track ////////////////////////////////////////

/* void response */

export type track_track_rpc = {
  method: 'track.track',
  param: {
    userAssertion: string,
    options: track_TrackOptions,
    forceRemoteCheck: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// track.trackWithToken ////////////////////////////////////////

/* void response */

export type track_trackWithToken_rpc = {
  method: 'track.trackWithToken',
  param: {
    trackToken: track_TrackToken,
    options: track_TrackOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// track.untrack ////////////////////////////////////////

/* void response */

export type track_untrack_rpc = {
  method: 'track.untrack',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// track.checkTracking ////////////////////////////////////////

/* void response */

export type track_checkTracking_rpc = {
  method: 'track.checkTracking',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

// track.fakeTrackingChanged ////////////////////////////////////////

/* void response */

export type track_fakeTrackingChanged_rpc = {
  method: 'track.fakeTrackingChanged',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type ui_Time = long

export type ui_StringKVPair = {
  key: string;
  value: string;
}

export type ui_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type ui_UID = string

export type ui_DeviceID = string

export type ui_SigID = string

export type ui_KID = string

export type ui_Text = {
  data: string;
  markup: boolean;
}

export type ui_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type ui_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type ui_User = {
  uid: UID;
  username: string;
}

export type ui_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type ui_Stream = {
  fd: int;
}

export type ui_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type ui_ClientType = 2 /* FORCE GUI ONLY */

export type ui_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type ui_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type ui_PromptDefault = 0 /* 'NONE_0' */ | 1 /* 'YES_1' */ | 2 /* 'NO_2' */

export type PromptDefault = 0 /* 'NONE_0' */ | 1 /* 'YES_1' */ | 2 /* 'NO_2' */

// ui.promptYesNo ////////////////////////////////////////

export type ui_promptYesNo_result = boolean

export type ui_promptYesNo_rpc = {
  method: 'ui.promptYesNo',
  param: {
    text: ui_Text,
    promptDefault: ui_PromptDefault
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: ui_promptYesNo_result) => void)
}

export type update_Time = long

export type update_StringKVPair = {
  key: string;
  value: string;
}

export type update_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type update_UID = string

export type update_DeviceID = string

export type update_SigID = string

export type update_KID = string

export type update_Text = {
  data: string;
  markup: boolean;
}

export type update_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type update_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type update_User = {
  uid: UID;
  username: string;
}

export type update_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type update_Stream = {
  fd: int;
}

export type update_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type update_ClientType = 2 /* FORCE GUI ONLY */

export type update_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type update_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type update_Asset = {
  name: string;
  url: string;
  digest: string;
  localPath: string;
}

export type Asset = {
  name: string;
  url: string;
  digest: string;
  localPath: string;
}

export type update_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type update_Update = {
  version: string;
  name: string;
  description: string;
  instructions?: ?string;
  type: UpdateType;
  publishedAt?: ?Time;
  asset?: ?Asset;
}

export type Update = {
  version: string;
  name: string;
  description: string;
  instructions?: ?string;
  type: UpdateType;
  publishedAt?: ?Time;
  asset?: ?Asset;
}

export type update_UpdateOptions = {
  version: string;
  platform: string;
  destinationPath: string;
  source: string;
  URL: string;
  channel: string;
  force: boolean;
  defaultInstructions: string;
}

export type UpdateOptions = {
  version: string;
  platform: string;
  destinationPath: string;
  source: string;
  URL: string;
  channel: string;
  force: boolean;
  defaultInstructions: string;
}

export type update_UpdateResult = {
  update?: ?Update;
}

export type UpdateResult = {
  update?: ?Update;
}

// update.update ////////////////////////////////////////

export type update_update_result = update_UpdateResult

export type update_update_rpc = {
  method: 'update.update',
  param: {
    options: update_UpdateOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: update_update_result) => void)
}

// update.updateCheck ////////////////////////////////////////

/* void response */

export type update_updateCheck_rpc = {
  method: 'update.updateCheck',
  param: {
    force: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any) => void)
}

export type updateUi_Time = long

export type updateUi_StringKVPair = {
  key: string;
  value: string;
}

export type updateUi_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type updateUi_UID = string

export type updateUi_DeviceID = string

export type updateUi_SigID = string

export type updateUi_KID = string

export type updateUi_Text = {
  data: string;
  markup: boolean;
}

export type updateUi_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type updateUi_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type updateUi_User = {
  uid: UID;
  username: string;
}

export type updateUi_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type updateUi_Stream = {
  fd: int;
}

export type updateUi_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type updateUi_ClientType = 2 /* FORCE GUI ONLY */

export type updateUi_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type updateUi_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type updateUi_Asset = {
  name: string;
  url: string;
  digest: string;
  localPath: string;
}

export type updateUi_UpdateType = 0 /* 'NORMAL_0' */ | 1 /* 'BUGFIX_1' */ | 2 /* 'CRITICAL_2' */

export type updateUi_Update = {
  version: string;
  name: string;
  description: string;
  instructions?: ?string;
  type: UpdateType;
  publishedAt?: ?Time;
  asset?: ?Asset;
}

export type updateUi_UpdateAction = 0 /* 'UPDATE_0' */ | 1 /* 'SKIP_1' */ | 2 /* 'SNOOZE_2' */ | 3 /* 'CANCEL_3' */

export type UpdateAction = 0 /* 'UPDATE_0' */ | 1 /* 'SKIP_1' */ | 2 /* 'SNOOZE_2' */ | 3 /* 'CANCEL_3' */

export type updateUi_UpdatePromptRes = {
  action: UpdateAction;
  alwaysAutoInstall: boolean;
  snoozeUntil: Time;
}

export type UpdatePromptRes = {
  action: UpdateAction;
  alwaysAutoInstall: boolean;
  snoozeUntil: Time;
}

export type updateUi_UpdatePromptOptions = {
  alwaysAutoInstall: boolean;
}

export type UpdatePromptOptions = {
  alwaysAutoInstall: boolean;
}

export type updateUi_UpdateQuitRes = {
  quit: boolean;
  pid: int;
  applicationPath: string;
}

export type UpdateQuitRes = {
  quit: boolean;
  pid: int;
  applicationPath: string;
}

// updateUi.updatePrompt ////////////////////////////////////////

export type updateUi_updatePrompt_result = updateUi_UpdatePromptRes

export type updateUi_updatePrompt_rpc = {
  method: 'updateUi.updatePrompt',
  param: {
    update: updateUi_Update,
    options: updateUi_UpdatePromptOptions
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: updateUi_updatePrompt_result) => void)
}

// updateUi.updateQuit ////////////////////////////////////////

export type updateUi_updateQuit_result = updateUi_UpdateQuitRes

export type updateUi_updateQuit_rpc = {
  method: 'updateUi.updateQuit',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: updateUi_updateQuit_result) => void)
}

export type user_Time = long

export type user_StringKVPair = {
  key: string;
  value: string;
}

export type user_Status = {
  code: int;
  name: string;
  desc: string;
  fields: Array<StringKVPair>;
}

export type user_UID = string

export type user_DeviceID = string

export type user_SigID = string

export type user_KID = string

export type user_Text = {
  data: string;
  markup: boolean;
}

export type user_PGPIdentity = {
  username: string;
  comment: string;
  email: string;
}

export type user_PublicKey = {
  KID: KID;
  PGPFingerprint: string;
  PGPIdentities: Array<PGPIdentity>;
  isSibkey: boolean;
  isEldest: boolean;
  parentID: string;
  deviceID: DeviceID;
  deviceDescription: string;
  deviceType: string;
  cTime: Time;
  eTime: Time;
}

export type user_User = {
  uid: UID;
  username: string;
}

export type user_Device = {
  type: string;
  name: string;
  deviceID: DeviceID;
  cTime: Time;
  mTime: Time;
  encryptKey: KID;
  verifyKey: KID;
  status: int;
}

export type user_Stream = {
  fd: int;
}

export type user_LogLevel = 0 /* 'NONE_0' */ | 1 /* 'DEBUG_1' */ | 2 /* 'INFO_2' */ | 3 /* 'NOTICE_3' */ | 4 /* 'WARN_4' */ | 5 /* 'ERROR_5' */ | 6 /* 'CRITICAL_6' */ | 7 /* 'FATAL_7' */

export type user_ClientType = 2 /* FORCE GUI ONLY */

export type user_UserVersionVector = {
  id: long;
  sigHints: int;
  sigChain: long;
  cachedAt: Time;
  lastIdentifiedAt: Time;
}

export type user_UserPlusKeys = {
  uid: UID;
  username: string;
  deviceKeys: Array<PublicKey>;
  keys: Array<PublicKey>;
  uvv: UserVersionVector;
}

export type user_Tracker = {
  tracker: UID;
  status: int;
  mTime: Time;
}

export type Tracker = {
  tracker: UID;
  status: int;
  mTime: Time;
}

export type user_TrackProof = {
  proofType: string;
  proofName: string;
  idString: string;
}

export type TrackProof = {
  proofType: string;
  proofName: string;
  idString: string;
}

export type user_WebProof = {
  hostname: string;
  protocols: Array<string>;
}

export type WebProof = {
  hostname: string;
  protocols: Array<string>;
}

export type user_Proofs = {
  social: Array<TrackProof>;
  web: Array<WebProof>;
  publicKeys: Array<PublicKey>;
}

export type Proofs = {
  social: Array<TrackProof>;
  web: Array<WebProof>;
  publicKeys: Array<PublicKey>;
}

export type user_UserSummary = {
  uid: UID;
  username: string;
  thumbnail: string;
  idVersion: int;
  fullName: string;
  bio: string;
  proofs: Proofs;
  sigIDDisplay: string;
  trackTime: Time;
}

export type UserSummary = {
  uid: UID;
  username: string;
  thumbnail: string;
  idVersion: int;
  fullName: string;
  bio: string;
  proofs: Proofs;
  sigIDDisplay: string;
  trackTime: Time;
}

export type user_SearchComponent = {
  key: string;
  value: string;
  score: double;
}

export type SearchComponent = {
  key: string;
  value: string;
  score: double;
}

export type user_SearchResult = {
  uid: UID;
  username: string;
  components: Array<SearchComponent>;
  score: double;
}

export type SearchResult = {
  uid: UID;
  username: string;
  components: Array<SearchComponent>;
  score: double;
}

// user.listTrackers ////////////////////////////////////////

export type user_listTrackers_result = Array<user_Tracker>

export type user_listTrackers_rpc = {
  method: 'user.listTrackers',
  param: {
    uid: user_UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackers_result) => void)
}

// user.listTrackersByName ////////////////////////////////////////

export type user_listTrackersByName_result = Array<user_Tracker>

export type user_listTrackersByName_rpc = {
  method: 'user.listTrackersByName',
  param: {
    username: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackersByName_result) => void)
}

// user.listTrackersSelf ////////////////////////////////////////

export type user_listTrackersSelf_result = Array<user_Tracker>

export type user_listTrackersSelf_rpc = {
  method: 'user.listTrackersSelf',
  param: {},
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackersSelf_result) => void)
}

// user.loadUncheckedUserSummaries ////////////////////////////////////////

export type user_loadUncheckedUserSummaries_result = Array<user_UserSummary>

export type user_loadUncheckedUserSummaries_rpc = {
  method: 'user.loadUncheckedUserSummaries',
  param: {
    uids: Array<user_UID>
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadUncheckedUserSummaries_result) => void)
}

// user.loadUser ////////////////////////////////////////

export type user_loadUser_result = user_User

export type user_loadUser_rpc = {
  method: 'user.loadUser',
  param: {
    uid: user_UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadUser_result) => void)
}

// user.loadUserPlusKeys ////////////////////////////////////////

export type user_loadUserPlusKeys_result = user_UserPlusKeys

export type user_loadUserPlusKeys_rpc = {
  method: 'user.loadUserPlusKeys',
  param: {
    uid: user_UID,
    cacheOK: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadUserPlusKeys_result) => void)
}

// user.loadPublicKeys ////////////////////////////////////////

export type user_loadPublicKeys_result = Array<user_PublicKey>

export type user_loadPublicKeys_rpc = {
  method: 'user.loadPublicKeys',
  param: {
    uid: user_UID
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_loadPublicKeys_result) => void)
}

// user.listTracking ////////////////////////////////////////

export type user_listTracking_result = Array<user_UserSummary>

export type user_listTracking_rpc = {
  method: 'user.listTracking',
  param: {
    filter: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTracking_result) => void)
}

// user.listTrackingJSON ////////////////////////////////////////

export type user_listTrackingJSON_result = string

export type user_listTrackingJSON_rpc = {
  method: 'user.listTrackingJSON',
  param: {
    filter: string,
    verbose: boolean
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_listTrackingJSON_result) => void)
}

// user.search ////////////////////////////////////////

export type user_search_result = Array<user_SearchResult>

export type user_search_rpc = {
  method: 'user.search',
  param: {
    query: string
  },
  incomingCallMap: ?incomingCallMapType,
  callback: (null | (err: ?any, response: user_search_result) => void)
}

