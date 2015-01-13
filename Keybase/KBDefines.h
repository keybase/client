//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

typedef void (^KBCompletion)(NSError *error);


#define KBMakeError(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"MPMessagePack" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey: [NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]
