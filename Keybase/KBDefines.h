//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

typedef void (^KBCompletionBlock)(NSError *error);
typedef void (^KBErrorBlock)(NSError *error);

#define KBMakeError(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey: [NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]


/*!
 NSColor *color = GHNSColorFromRGB(0xBC1128);
 */
#define GHNSColorFromRGB(rgbValue) [NSColor colorWithRed:((float)((rgbValue & 0xFF0000) >> 16))/255.0 green:((float)((rgbValue & 0xFF00) >> 8))/255.0 blue:((float)(rgbValue & 0xFF))/255.0 alpha:1.0]