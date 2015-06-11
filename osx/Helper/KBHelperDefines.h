//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, KBHelperError) {
  KBHelperErrorKBFS = -1000,
};

typedef void (^KBOnCompletion)(NSError *error, id value);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBOrNull(obj) (obj ? obj : NSNull.null)
#define KBOr(obj, dv) (obj ? obj : dv)
#define KBIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)


void KBHelperLog(NSString *msg, ...);

NSString *KBNSStringWithFormat(NSString *formatString, ...);

#undef KBLog
#define KBLog KBHelperLog