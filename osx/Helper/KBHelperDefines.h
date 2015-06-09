//
//  KBHelperDefines.h
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

typedef NS_ENUM(NSInteger, KBHelperError) {
  KBHelperErrorKBFS = -1000,
};


void KBHelperLog(NSString *msg, ...);

#undef KBLog
#define KBLog KBHelperLog