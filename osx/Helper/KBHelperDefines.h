//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBSharedDefines.h"

typedef NS_ENUM(NSInteger, KBHelperError) {
  KBHelperErrorKBFS = -1000,
};

// Copied from ObjectiveSugar
NSString *KBNSStringWithFormat(NSString *formatString, ...);

void KBLog(NSString *msg, ...);

