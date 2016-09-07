//
//  Settings.h
//  Keybase
//
//  Created by Gabriel on 1/11/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBEnvironment.h>
#import <GBCli/GBCli.h>

typedef NS_OPTIONS (NSUInteger, UninstallOptions) {
  UninstallOptionNone = 0,
  UninstallOptionApp = 1 << 0,
  UninstallOptionKext = 1 << 1,
  UninstallOptionMountDir = 1 << 2,
};

@interface Settings : NSObject

@property (readonly) NSString *appPath;
@property (readonly) NSString *runMode;
@property (readonly) UninstallOptions uninstallOptions;

- (instancetype)initWithSettings:(GBSettings *)settings;

- (BOOL)parseArgs:(NSError **)error;

- (KBEnvironment *)environment;

- (BOOL)isUninstall;

@end
