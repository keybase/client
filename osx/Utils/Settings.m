//
//  Settings.m
//  Keybase
//
//  Created by Gabriel on 1/11/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Settings.h"

@interface Settings ()
@property NSString *appPath;
@property NSString *runMode;
@property UninstallOptions uninstallOptions;
@property KBInstallOptions installOptions;
@property GBSettings *settings;
@end

@implementation Settings

- (instancetype)init {
  if ((self = [self initWithSettings:[GBSettings settingsWithName:@"Settings" parent:nil]])) {
  }
  return self;
}

- (instancetype)initWithSettings:(GBSettings *)settings {
  if ((self = [super init])) {
    self.settings = settings;
  }
  return self;
}

- (BOOL)parseArgs:(NSError **)error {
  NSArray *args = NSProcessInfo.processInfo.arguments;
  GBCommandLineParser *parser = [[GBCommandLineParser alloc] init];
  [parser registerOption:@"app-path" shortcut:'a' requirement:GBValueRequired];
  [parser registerOption:@"run-mode" shortcut:'r' requirement:GBValueRequired];
  [parser registerSwitch:@"uninstall-app"];
  [parser registerSwitch:@"uninstall-fuse"];
  [parser registerSwitch:@"uninstall-mountdir"];
  [parser registerSwitch:@"uninstall-helper"];
  [parser registerSwitch:@"uninstall"];
  [parser registerSwitch:@"install-fuse"];
  [parser registerSettings:self.settings];
  NSArray *subargs = [args subarrayWithRange:NSMakeRange(1, args.count-1)];
  if (![parser parseOptionsWithArguments:subargs commandLine:args[0]]) {
    if (error) *error = KBMakeError(-1, @"Unable to process arguments");
    return NO;
  }
  self.runMode = [self.settings objectForKey:@"run-mode"];
  NSAssert(self.runMode, @"No run mode");
  self.appPath = [self.settings objectForKey:@"app-path"];
  NSAssert(self.appPath, @"No app path");
  if ([[self.settings objectForKey:@"uninstall-app"] boolValue]) {
    self.uninstallOptions |= UninstallOptionApp;
  }
  if ([[self.settings objectForKey:@"uninstall-fuse"] boolValue]) {
    self.uninstallOptions |= UninstallOptionFuse;
  }
  if ([[self.settings objectForKey:@"uninstall-mountdir"] boolValue]) {
    self.uninstallOptions |= UninstallOptionMountDir;
  }
  if ([[self.settings objectForKey:@"uninstall-helper"] boolValue]) {
    self.uninstallOptions |= UninstallOptionHelper;
  }
  if ([[self.settings objectForKey:@"uninstall"] boolValue]) {
    self.installOptions |= UninstallOptionAll;
  }

  if ([[self.settings objectForKey:@"install-fuse"] boolValue]) {
    self.installOptions |= KBInstallOptionFuse;
  }
  if (self.installOptions == 0) {
    self.installOptions = KBInstallOptionAll;
  }
  return YES;
}

- (KBEnvironment *)environment {
  NSAssert(self.runMode, @"No run mode");
  NSString *servicePath = [self.appPath stringByAppendingPathComponent:@"Contents/SharedSupport/bin"];
  KBEnvironment *environment = [KBEnvironment environmentForRunModeString:self.runMode servicePath:servicePath options:self.installOptions];
  return environment;
}

- (BOOL)isUninstall {
  return _uninstallOptions != 0;
}

@end
