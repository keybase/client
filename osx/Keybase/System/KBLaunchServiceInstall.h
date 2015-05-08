//
//  KBLaunchServiceInstall.h
//  Keybase
//
//  Created by Gabriel on 5/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBLaunchService.h"

@interface KBLaunchServiceInstall : NSObject

@property KBLaunchService *service;
@property NSError *error;
@property BOOL installed;

@end
