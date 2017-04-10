//
//  KBLog.h
//  Keybase
//
//  Created by Gabriel on 9/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <CocoaLumberjack/CocoaLumberjack.h>

typedef NS_OPTIONS (NSUInteger, KBLogFlag) {
  KBLogError = DDLogFlagError,
  KBLogWarn = DDLogFlagWarning,
  KBLogInfo = DDLogFlagInfo,
  KBLogDebug = DDLogFlagDebug,
  KBLogVerbose = DDLogFlagVerbose,

  // Custom categories
  KBLogRPC = (1 << 5),
};

#define KBLog(options, frmt, ...) LOG_MAYBE(LOG_ASYNC_ENABLED, LOG_LEVEL_DEF, options, 0, nil, __PRETTY_FUNCTION__, frmt, ##__VA_ARGS__)
