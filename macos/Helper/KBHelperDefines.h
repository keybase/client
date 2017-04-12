//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, KBHelperError) {
  KBHelperErrorKext = -1000,
};

typedef void (^KBCompletion)(NSError *error);
typedef void (^KBOnCompletion)(NSError *error, id value);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBOr(obj, dv) (obj ? obj : dv)
#define KBIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)

NSString *KBNSStringWithFormat(NSString *formatString, ...);
