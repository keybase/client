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
#import "KBFSService.h"
#import "KBFuseComponent.h"

@interface KBEnvironment : NSObject

@property (readonly) KBHelperTool *helperTool;
@property (readonly) KBEnvConfig *config;
@property (readonly) KBService *service;
@property (readonly) KBFSService *kbfs;
@property (readonly) KBFuseComponent *fuse;
@property (readonly) NSArray */*of KBInstallable*/installables;

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath;

- (NSArray *)componentsForControlPanel;

- (NSString *)debugInstallables;

- (id)configValueForKey:(NSString *)keyPath defaultValue:(id)defaultValue error:(NSError **)error;

@end
