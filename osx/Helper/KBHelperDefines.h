//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"KeybaseHelper" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]
