//
//  KBEnvironment.h
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBEnvConfig.h"
#import "KBService.h"
#import "KBInstallAction.h"

@interface KBEnvironment : NSObject

@property (readonly) KBEnvConfig *config;
@property (readonly) KBService *service;
@property (readonly) NSArray */*of KBInstallAction*/installActions;

- (instancetype)initWithConfig:(KBEnvConfig *)config;

- (void)installStatus:(void (^)(BOOL needsInstall))completion;

- (NSArray *)installActionsNeeded;

- (void)uninstallServices:(KBCompletion)completion;

- (NSArray *)componentsForControlPanel;

@end
