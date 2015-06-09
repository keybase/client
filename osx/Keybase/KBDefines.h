//
//  KBSharedDefines.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

//
// This file should have no dependencies
//

typedef void (^KBCompletion)(NSError *error);
typedef void (^KBOnCompletion)(NSError *error, id value);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBMakeErrorWithRecovery(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey:[NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]


#define KBOrNull(obj) (obj ? obj : NSNull.null)
#define KBOr(obj, dv) (obj ? obj : dv)
#define KBIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)

NSNumber *KBNumberFromString(NSString *s);

NSString *KBNSStringWithFormat(NSString *formatString, ...);

NSString *KBPath(NSString *path, BOOL tilde, BOOL escape);

#define LINK_SOURCE (@"/usr/local/bin/keybase")

#define KBLog NSLog
