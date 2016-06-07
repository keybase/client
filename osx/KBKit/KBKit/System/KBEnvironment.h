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
  KBInstallOptionHelper = 2 << 1,
  KBInstallOptionFuse = 3 << 1,
  KBInstallOptionKBFS = 4 << 1,
  KBInstallOptionCLI = 10 << 1,

  KBInstallOptionAll = KBInstallOptionService | KBInstallOptionHelper | KBInstallOptionKBFS | KBInstallOptionFuse | KBInstallOptionCLI,
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

+ (instancetype)environmentForRunModeString:(NSString *)runModeString servicePath:(NSString *)servicePath;

- (NSString *)debugInstallables;

- (id)configValueForKey:(NSString *)keyPath defaultValue:(id)defaultValue error:(NSError **)error;

@end
