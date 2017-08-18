//
//  Options.h
//  Keybase
//
//  Created by Gabriel on 1/11/16.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBEnvironment.h>
#import <GBCli/GBCli.h>

typedef NS_OPTIONS (NSUInteger, UninstallOptions) {
  UninstallOptionNone = 0,
  UninstallOptionApp = 1 << 0,
  UninstallOptionFuse = 1 << 1,
  UninstallOptionMountDir = 1 << 2,
  UninstallOptionHelper = 1 << 3,

  // Uninstall all (except for app)
  UninstallOptionAll = UninstallOptionMountDir | UninstallOptionFuse | UninstallOptionHelper,
};

@interface Options : NSObject

@property (readonly) NSString *appPath;
@property (readonly) NSString *runMode;
@property (readonly) NSString *sourcePath;
@property (readonly) UninstallOptions uninstallOptions;

- (instancetype)initWithSettings:(GBSettings *)settings;

- (BOOL)parseArgs:(NSError **)error;

- (KBEnvironment *)environment;

- (BOOL)isUninstall;

@end
