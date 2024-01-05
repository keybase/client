//
//  Defines.h
//  Updater
//
//  Created by Gabriel on 4/13/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#define KBMakeError(MSG, ...) [NSError errorWithDomain:@"Updater" code:-1 userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]
