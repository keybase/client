//
//  KBHelper.h
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBHelperDefines.h"

#import <MPMessagePack/MPMessagePack.h>
#import <MPMessagePack/MPXPCService.h>

@interface KBHelper : MPXPCService

+ (int)run;

@end
