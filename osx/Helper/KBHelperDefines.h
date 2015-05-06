//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, KBErrorCode) {
  KBErrorCodeInstaller = -1000,
};

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"KeybaseHelper" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

// Copied from ObjectiveSugar
NSString *KBNSStringWithFormat(NSString *formatString, ...);

#define KBOrNull(obj) (obj ? obj : NSNull.null)
