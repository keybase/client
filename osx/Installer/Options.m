//
//  Options.m
//  Keybase
//
//  Created by Gabriel on 1/11/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Options.h"

@interface Options ()
@property NSString *appPath;
@property NSString *runMode;
@property NSString *sourcePath;
@property UninstallOptions uninstallOptions;
@property KBInstallOptions installOptions;
@property NSInteger installTimeout; // In (whole) seconds
@property GBSettings *settings;
@end

@implementation Options

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
  [parser registerOption:@"app-path" requirement:GBValueRequired];
  [parser registerOption:@"run-mode" requirement:GBValueRequired];
  [parser registerOption:@"timeout" requirement:GBValueRequired];
  [parser registerSwitch:@"uninstall-app"];
  [parser registerSwitch:@"uninstall-fuse"];
  [parser registerSwitch:@"uninstall-mountdir"];
  [parser registerSwitch:@"uninstall-helper"];
  [parser registerSwitch:@"uninstall"];
  [parser registerSwitch:@"install-fuse"];
  [parser registerSwitch:@"install-mountdir"];
  [parser registerSwitch:@"install-helper"];
  [parser registerSwitch:@"install-app-bundle"];
  [parser registerOption:@"source-path" requirement:GBValueOptional]; // If using install-app-bundle
  [parser registerSwitch:@"debug"];
  [parser registerSettings:self.settings];
  NSArray *subargs = [args subarrayWithRange:NSMakeRange(1, args.count-1)];
  if (![parser parseOptionsWithArguments:subargs commandLine:args[0]]) {
    if (error) *error = KBMakeError(-1, @"Unable to process arguments");
    return NO;
  }
  self.runMode = [self.settings objectForKey:@"run-mode"];
  if (!self.runMode) {
    if (error) *error = KBMakeError(-1, @"No run mode");
    return NO;
  }
  self.appPath = [self.settings objectForKey:@"app-path"];
  if (!self.appPath) {
    if (error) *error = KBMakeError(-1, @"No app path");
    return NO;
  }
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
  if ([[self.settings objectForKey:@"install-mountdir"] boolValue]) {
    self.installOptions |= KBInstallOptionMountDir;
  }
  if ([[self.settings objectForKey:@"install-helper"] boolValue]) {
    self.installOptions |= KBInstallOptionHelper;
  }
  if ([[self.settings objectForKey:@"install-app-bundle"] boolValue]) {
    self.installOptions |= KBInstallOptionAppBundle;
    self.sourcePath = [self.settings objectForKey:@"source-path"];
  }
  if (self.installOptions == 0) {
    self.installOptions = KBInstallOptionAll;
  }
  self.installTimeout = [[self.settings objectForKey:@"timeout"] intValue];
  if (self.installTimeout <= 0) {
    if (error) *error = KBMakeError(-1, @"Invalid timeout: %@", @(self.installTimeout));
    return NO;
  }

  return YES;
}

- (KBEnvironment *)environment {
  NSString *servicePath = [self.appPath stringByAppendingPathComponent:@"Contents/SharedSupport/bin"];
  KBEnvConfig *envConfig = [KBEnvConfig envConfigWithRunModeString:self.runMode installOptions:self.installOptions installTimeout:self.installTimeout appPath:self.appPath sourcePath:self.sourcePath];
  KBEnvironment *environment = [[KBEnvironment alloc] initWithConfig:envConfig servicePath:servicePath];
  return environment;
}

- (BOOL)isUninstall {
  return _uninstallOptions != 0;
}

@end
