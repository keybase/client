//
//  KBEnvironment.h
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBEnvConfig.h>
#import <KBKit/KBService.h>
#import <KBKit/KBFSService.h>

@interface KBEnvironment : NSObject

@property (readonly) KBEnvConfig *config;
@property (readonly) KBService *service;
@property (readonly) KBFSService *kbfs;
@property (readonly) NSArray */*of KBInstallable*/installables;

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath;

- (NSArray *)componentsForControlPanel;

+ (instancetype)environmentForRunModeString:(NSString *)runModeString servicePath:(NSString *)servicePath;

@end
