//
//  KBSharedDefines.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

// Defines shared between app and Helper

typedef void (^KBCompletion)(NSError *error);
typedef void (^KBOnCompletion)(NSError *error, id value);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBMakeErrorWithRecovery(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey:[NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]


#define KBOrNull(obj) (obj ? obj : NSNull.null)
#define KBOr(obj, dv) (obj ? obj : dv)

NSNumber *KBNumberFromString(NSString *s);
NSString *KBHexString(NSData *data, NSString *defaultValue);
NSData *KBHexData(NSString *s);

NSString *KBNSStringWithFormat(NSString *formatString, ...);

NSString *KBPath(NSString *dir, BOOL tilde);

#define LINK_SOURCE (@"/usr/local/bin/keybase")
#define LINK_DESTINATION (@"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase")
