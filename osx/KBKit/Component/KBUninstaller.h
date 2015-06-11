//
//  KBUninstaller.h
//  Keybase
//
//  Created by Gabriel on 6/11/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

@interface KBUninstaller : NSObject

+ (void)uninstall:(NSString *)prefix completion:(KBCompletion)completion;

@end
