//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, KBErrorCode) {
  KBErrorCodeXPCInvalidRequest = -1,
  KBErrorCodeXPCUnknownRequest = -2,

  KBErrorCodeInstaller = -1000,
};

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"KeybaseHelper" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]
