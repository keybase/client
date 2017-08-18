//
//  KBUninstaller.h
//  Keybase
//
//  Created by Gabriel on 6/11/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

@interface KBUninstaller : NSObject

+ (void)uninstallServicesWithPrefix:(NSString *)prefix completion:(KBCompletion)completion;

+ (void)uninstall:(NSArray *)installables completion:(KBCompletion)completion;

@end
