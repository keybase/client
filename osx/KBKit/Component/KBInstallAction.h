//
//  KBLaunchServiceInstall.h
//  Keybase
//
//  Created by Gabriel on 5/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBComponentStatus.h"
#import "KBInstallable.h"

@interface KBInstallAction : NSObject

@property (readonly) id<KBInstallable> installable;

@property BOOL installAttempted;
@property NSError *installError; // If there was

+ (instancetype)installActionWithInstallable:(id<KBInstallable>)installable;

- (NSString *)name;
- (NSString *)statusDescription;

@end
