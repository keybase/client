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

typedef NS_OPTIONS (NSUInteger, KBInstallOptions) {
  KBInstallOptionNone = 0,
  KBInstallOptionService = 1 << 1,
  KBInstallOptionHelper = 1 << 2,
  KBInstallOptionFuse = 1 << 3,
  KBInstallOptionKBFS = 1 << 4,
  KBInstallOptionUpdater = 1 << 5,
  KBInstallOptionCLI = 1 << 10,

  KBInstallOptionAll = KBInstallOptionService | KBInstallOptionHelper | KBInstallOptionFuse | KBInstallOptionKBFS | KBInstallOptionUpdater | KBInstallOptionCLI,
};

@interface KBEnvironment : NSObject

@property (readonly) KBEnvConfig *config;
@property (readonly) KBService *service;
@property (readonly) KBFSService *kbfs;
@property (readonly) KBFuseComponent *fuse;
@property (readonly) NSArray */*of KBInstallable*/installables;

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath options:(KBInstallOptions)options;

+ (instancetype)environmentForRunModeString:(NSString *)runModeString servicePath:(NSString *)servicePath options:(KBInstallOptions)options;

- (NSArray *)componentsForControlPanel;

- (NSString *)debugInstallables;

- (id)configValueForKey:(NSString *)keyPath defaultValue:(id)defaultValue error:(NSError **)error;

@end
