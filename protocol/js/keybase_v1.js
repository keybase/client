export default {
  'account': {},
  'block': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'BTC': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'config': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ForkType': {
      'none': 0,
      'auto': 1,
      'watchdog': 2,
      'launchd': 3
    },
    'InstallStatus': {
      'unknown': 0,
      'error': 1,
      'notInstalled': 2,
      'installed': 4
    },
    'InstallAction': {
      'unknown': 0,
      'none': 1,
      'upgrade': 2,
      'reinstall': 3,
      'install': 4
    }
  },
  'crypto': {},
  'ctl': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ExitCode': {
      'ok': 0,
      'notok': 2,
      'restart': 4
    }
  },
  'debugging': {},
  'delegateUiCtl': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'device': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'favorite': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'gpgUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ClientType': {
      'cli': 0,
      'gui': 1
    }
  },
  'identify': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProofState': {
      'none': 0,
      'ok': 1,
      'tempFailure': 2,
      'permFailure': 3,
      'looking': 4,
      'superseded': 5,
      'posted': 6,
      'revoked': 7
    },
    'ProofStatus': {
      'none': 0,
      'ok': 1,
      'local': 2,
      'found': 3,
      'baseError': 100,
      'hostUnreachable': 101,
      'permissionDenied': 103,
      'failedParse': 106,
      'dnsError': 107,
      'authFailed': 108,
      'http500': 150,
      'timeout': 160,
      'internalError': 170,
      'baseHardError': 200,
      'notFound': 201,
      'contentFailure': 202,
      'badUsername': 203,
      'badRemoteId': 204,
      'textNotFound': 205,
      'badArgs': 206,
      'contentMissing': 207,
      'titleNotFound': 208,
      'serviceError': 209,
      'torSkipped': 210,
      'torIncompatible': 211,
      'http300': 230,
      'http400': 240,
      'httpOther': 260,
      'emptyJson': 270,
      'deleted': 301,
      'serviceDead': 302,
      'badSignature': 303,
      'badApiUrl': 304,
      'unknownType': 305,
      'noHint': 306,
      'badHintText': 307
    },
    'ProofType': {
      'none': 0,
      'keybase': 1,
      'twitter': 2,
      'github': 3,
      'reddit': 4,
      'coinbase': 5,
      'hackernews': 6,
      'genericWebSite': 1000,
      'dns': 1001,
      'rooter': 100001
    },
    'TrackDiffType': {
      'none': 0,
      'error': 1,
      'clash': 2,
      'revoked': 3,
      'upgraded': 4,
      'new': 5,
      'remoteFail': 6,
      'remoteWorking': 7,
      'remoteChanged': 8,
      'newEldest': 9
    },
    'TrackStatus': {
      'newOk': 1,
      'newZeroProofs': 2,
      'newFailProofs': 3,
      'updateBroken': 4,
      'updateNewProofs': 5,
      'updateOk': 6
    }
  },
  'identifyUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProofState': {
      'none': 0,
      'ok': 1,
      'tempFailure': 2,
      'permFailure': 3,
      'looking': 4,
      'superseded': 5,
      'posted': 6,
      'revoked': 7
    },
    'ProofStatus': {
      'none': 0,
      'ok': 1,
      'local': 2,
      'found': 3,
      'baseError': 100,
      'hostUnreachable': 101,
      'permissionDenied': 103,
      'failedParse': 106,
      'dnsError': 107,
      'authFailed': 108,
      'http500': 150,
      'timeout': 160,
      'internalError': 170,
      'baseHardError': 200,
      'notFound': 201,
      'contentFailure': 202,
      'badUsername': 203,
      'badRemoteId': 204,
      'textNotFound': 205,
      'badArgs': 206,
      'contentMissing': 207,
      'titleNotFound': 208,
      'serviceError': 209,
      'torSkipped': 210,
      'torIncompatible': 211,
      'http300': 230,
      'http400': 240,
      'httpOther': 260,
      'emptyJson': 270,
      'deleted': 301,
      'serviceDead': 302,
      'badSignature': 303,
      'badApiUrl': 304,
      'unknownType': 305,
      'noHint': 306,
      'badHintText': 307
    },
    'ProofType': {
      'none': 0,
      'keybase': 1,
      'twitter': 2,
      'github': 3,
      'reddit': 4,
      'coinbase': 5,
      'hackernews': 6,
      'genericWebSite': 1000,
      'dns': 1001,
      'rooter': 100001
    },
    'TrackDiffType': {
      'none': 0,
      'error': 1,
      'clash': 2,
      'revoked': 3,
      'upgraded': 4,
      'new': 5,
      'remoteFail': 6,
      'remoteWorking': 7,
      'remoteChanged': 8,
      'newEldest': 9
    },
    'TrackStatus': {
      'newOk': 1,
      'newZeroProofs': 2,
      'newFailProofs': 3,
      'updateBroken': 4,
      'updateNewProofs': 5,
      'updateOk': 6
    }
  },
  'kbcmf': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProofState': {
      'none': 0,
      'ok': 1,
      'tempFailure': 2,
      'permFailure': 3,
      'looking': 4,
      'superseded': 5,
      'posted': 6,
      'revoked': 7
    },
    'ProofStatus': {
      'none': 0,
      'ok': 1,
      'local': 2,
      'found': 3,
      'baseError': 100,
      'hostUnreachable': 101,
      'permissionDenied': 103,
      'failedParse': 106,
      'dnsError': 107,
      'authFailed': 108,
      'http500': 150,
      'timeout': 160,
      'internalError': 170,
      'baseHardError': 200,
      'notFound': 201,
      'contentFailure': 202,
      'badUsername': 203,
      'badRemoteId': 204,
      'textNotFound': 205,
      'badArgs': 206,
      'contentMissing': 207,
      'titleNotFound': 208,
      'serviceError': 209,
      'torSkipped': 210,
      'torIncompatible': 211,
      'http300': 230,
      'http400': 240,
      'httpOther': 260,
      'emptyJson': 270,
      'deleted': 301,
      'serviceDead': 302,
      'badSignature': 303,
      'badApiUrl': 304,
      'unknownType': 305,
      'noHint': 306,
      'badHintText': 307
    },
    'ProofType': {
      'none': 0,
      'keybase': 1,
      'twitter': 2,
      'github': 3,
      'reddit': 4,
      'coinbase': 5,
      'hackernews': 6,
      'genericWebSite': 1000,
      'dns': 1001,
      'rooter': 100001
    },
    'TrackDiffType': {
      'none': 0,
      'error': 1,
      'clash': 2,
      'revoked': 3,
      'upgraded': 4,
      'new': 5,
      'remoteFail': 6,
      'remoteWorking': 7,
      'remoteChanged': 8
    },
    'TrackStatus': {
      'newOk': 1,
      'newZeroProofs': 2,
      'newFailProofs': 3,
      'updateBroken': 4,
      'updateNewProofs': 5,
      'updateOk': 6
    }
  },
  'kbfs': {
    'FSStatusCode': {
      'start': 0,
      'finish': 1,
      'error': 2
    },
    'FSNotificationType': {
      'encrypting': 0,
      'decrypting': 1,
      'signing': 2,
      'verifying': 3,
      'rekeying': 4
    }
  },
  'Kex2Provisionee': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'Kex2Provisioner': {},
  'logUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'login': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ClientType': {
      'cli': 0,
      'gui': 1
    }
  },
  'loginUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'metadata': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ClientType': {
      'cli': 0,
      'gui': 1
    }
  },
  'metadataUpdate': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'notifyCtl': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'NotifyFS': {
    'FSStatusCode': {
      'start': 0,
      'finish': 1,
      'error': 2
    },
    'FSNotificationType': {
      'encrypting': 0,
      'decrypting': 1,
      'signing': 2,
      'verifying': 3,
      'rekeying': 4
    }
  },
  'NotifySession': {},
  'NotifyUsers': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'pgp': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProofState': {
      'none': 0,
      'ok': 1,
      'tempFailure': 2,
      'permFailure': 3,
      'looking': 4,
      'superseded': 5,
      'posted': 6,
      'revoked': 7
    },
    'ProofStatus': {
      'none': 0,
      'ok': 1,
      'local': 2,
      'found': 3,
      'baseError': 100,
      'hostUnreachable': 101,
      'permissionDenied': 103,
      'failedParse': 106,
      'dnsError': 107,
      'authFailed': 108,
      'http500': 150,
      'timeout': 160,
      'internalError': 170,
      'baseHardError': 200,
      'notFound': 201,
      'contentFailure': 202,
      'badUsername': 203,
      'badRemoteId': 204,
      'textNotFound': 205,
      'badArgs': 206,
      'contentMissing': 207,
      'titleNotFound': 208,
      'serviceError': 209,
      'torSkipped': 210,
      'torIncompatible': 211,
      'http300': 230,
      'http400': 240,
      'httpOther': 260,
      'emptyJson': 270,
      'deleted': 301,
      'serviceDead': 302,
      'badSignature': 303,
      'badApiUrl': 304,
      'unknownType': 305,
      'noHint': 306,
      'badHintText': 307
    },
    'ProofType': {
      'none': 0,
      'keybase': 1,
      'twitter': 2,
      'github': 3,
      'reddit': 4,
      'coinbase': 5,
      'hackernews': 6,
      'genericWebSite': 1000,
      'dns': 1001,
      'rooter': 100001
    },
    'TrackDiffType': {
      'none': 0,
      'error': 1,
      'clash': 2,
      'revoked': 3,
      'upgraded': 4,
      'new': 5,
      'remoteFail': 6,
      'remoteWorking': 7,
      'remoteChanged': 8,
      'newEldest': 9
    },
    'TrackStatus': {
      'newOk': 1,
      'newZeroProofs': 2,
      'newFailProofs': 3,
      'updateBroken': 4,
      'updateNewProofs': 5,
      'updateOk': 6
    },
    'SignMode': {
      'attached': 0,
      'detached': 1,
      'clear': 2
    }
  },
  'prove': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProofState': {
      'none': 0,
      'ok': 1,
      'tempFailure': 2,
      'permFailure': 3,
      'looking': 4,
      'superseded': 5,
      'posted': 6,
      'revoked': 7
    },
    'ProofStatus': {
      'none': 0,
      'ok': 1,
      'local': 2,
      'found': 3,
      'baseError': 100,
      'hostUnreachable': 101,
      'permissionDenied': 103,
      'failedParse': 106,
      'dnsError': 107,
      'authFailed': 108,
      'http500': 150,
      'timeout': 160,
      'internalError': 170,
      'baseHardError': 200,
      'notFound': 201,
      'contentFailure': 202,
      'badUsername': 203,
      'badRemoteId': 204,
      'textNotFound': 205,
      'badArgs': 206,
      'contentMissing': 207,
      'titleNotFound': 208,
      'serviceError': 209,
      'torSkipped': 210,
      'torIncompatible': 211,
      'http300': 230,
      'http400': 240,
      'httpOther': 260,
      'emptyJson': 270,
      'deleted': 301,
      'serviceDead': 302,
      'badSignature': 303,
      'badApiUrl': 304,
      'unknownType': 305,
      'noHint': 306,
      'badHintText': 307
    },
    'ProofType': {
      'none': 0,
      'keybase': 1,
      'twitter': 2,
      'github': 3,
      'reddit': 4,
      'coinbase': 5,
      'hackernews': 6,
      'genericWebSite': 1000,
      'dns': 1001,
      'rooter': 100001
    },
    'TrackDiffType': {
      'none': 0,
      'error': 1,
      'clash': 2,
      'revoked': 3,
      'upgraded': 4,
      'new': 5,
      'remoteFail': 6,
      'remoteWorking': 7,
      'remoteChanged': 8,
      'newEldest': 9
    },
    'TrackStatus': {
      'newOk': 1,
      'newZeroProofs': 2,
      'newFailProofs': 3,
      'updateBroken': 4,
      'updateNewProofs': 5,
      'updateOk': 6
    }
  },
  'proveUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'PromptOverwriteType': {
      'social': 0,
      'site': 1
    }
  },
  'provisionUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProvisionMethod': {
      'device': 0,
      'paperKey': 1,
      'passphrase': 2,
      'gpgImport': 3,
      'gpgSign': 4
    },
    'DeviceType': {
      'desktop': 0,
      'mobile': 1
    }
  },
  'quota': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'revoke': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'secretUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'session': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'signup': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'sigs': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'streamUi': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  },
  'test': {},
  'track': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'ProofState': {
      'none': 0,
      'ok': 1,
      'tempFailure': 2,
      'permFailure': 3,
      'looking': 4,
      'superseded': 5,
      'posted': 6,
      'revoked': 7
    },
    'ProofStatus': {
      'none': 0,
      'ok': 1,
      'local': 2,
      'found': 3,
      'baseError': 100,
      'hostUnreachable': 101,
      'permissionDenied': 103,
      'failedParse': 106,
      'dnsError': 107,
      'authFailed': 108,
      'http500': 150,
      'timeout': 160,
      'internalError': 170,
      'baseHardError': 200,
      'notFound': 201,
      'contentFailure': 202,
      'badUsername': 203,
      'badRemoteId': 204,
      'textNotFound': 205,
      'badArgs': 206,
      'contentMissing': 207,
      'titleNotFound': 208,
      'serviceError': 209,
      'torSkipped': 210,
      'torIncompatible': 211,
      'http300': 230,
      'http400': 240,
      'httpOther': 260,
      'emptyJson': 270,
      'deleted': 301,
      'serviceDead': 302,
      'badSignature': 303,
      'badApiUrl': 304,
      'unknownType': 305,
      'noHint': 306,
      'badHintText': 307
    },
    'ProofType': {
      'none': 0,
      'keybase': 1,
      'twitter': 2,
      'github': 3,
      'reddit': 4,
      'coinbase': 5,
      'hackernews': 6,
      'genericWebSite': 1000,
      'dns': 1001,
      'rooter': 100001
    },
    'TrackDiffType': {
      'none': 0,
      'error': 1,
      'clash': 2,
      'revoked': 3,
      'upgraded': 4,
      'new': 5,
      'remoteFail': 6,
      'remoteWorking': 7,
      'remoteChanged': 8,
      'newEldest': 9
    },
    'TrackStatus': {
      'newOk': 1,
      'newZeroProofs': 2,
      'newFailProofs': 3,
      'updateBroken': 4,
      'updateNewProofs': 5,
      'updateOk': 6
    }
  },
  'ui': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    },
    'PromptDefault': {
      'none': 0,
      'yes': 1,
      'no': 2
    }
  },
  'user': {
    'LogLevel': {
      'none': 0,
      'debug': 1,
      'info': 2,
      'notice': 3,
      'warn': 4,
      'error': 5,
      'critical': 6,
      'fatal': 7
    }
  }
}
