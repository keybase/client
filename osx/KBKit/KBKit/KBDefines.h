//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

#import <CocoaLumberjack/CocoaLumberjack.h>
static const int ddLogLevel = DDLogLevelDebug;

typedef void (^KBCompletion)(NSError *error);

typedef NS_ENUM (NSInteger, KBErrorCode) {
  KBErrorCodeWarning = 0,
  KBErrorCodeGeneric = -1,
  KBErrorCodeUnsupported = -10,

  KBErrorCodeInstallError = -101,

  KBErrorCodeTimeout = -210,

  KBErrorCodeFuseKext = -300,
  KBErrorCodeFuseKextPermission = -301,
  KBErrorCodeFuseKextMountsPresent = -302,
  KBErrorCodeFuseCriticalUpdate = -303,
};

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__]}]

#define KBMakeWarning(MSG, ...) KBMakeError(KBErrorCodeWarning, MSG, ##__VA_ARGS__)
#define KBIsWarning(ERR) ((ERR.code == KBErrorCodeWarning))

#define KBIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)

