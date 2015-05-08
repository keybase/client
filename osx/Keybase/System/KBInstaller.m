//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstaller.h"

#import "KBDefines.h"
#import "AppDelegate.h"
//#include <launch.h>
#import "KBLaunchService.h"
#import <ServiceManagement/ServiceManagement.h>
#import "KBRunOver.h"
#import "KBLaunchServiceInstall.h"

@interface KBInstaller ()
@property KBEnvironment *environment;
@end

@implementation KBInstaller

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super init])) {
    _environment = environment;
  }
  return self;
}

- (void)checkInstall:(KBInstallCheck)completion {
  KBLaunchService *service = [[KBLaunchService alloc] initWithLabel:_environment.launchdLabelService plist:_environment.launchdPlistDictionaryForService];
  KBLaunchService *kbfs = [[KBLaunchService alloc] initWithLabel:_environment.launchdLabelKBFS plist:_environment.launchdPlistDictionaryForKBFS];

  NSArray *services = @[service, kbfs];

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = services;
  rover.runBlock = ^(KBLaunchService *service, KBRunCompletion runCompletion) {
    [service status:^(NSError *error, NSInteger pid) {
      if (error) {
        KBLaunchServiceInstall *install = [[KBLaunchServiceInstall alloc] init];
        install.error = error;
        install.service = service;
        runCompletion(install);
        return;
      }
      /*
       if (pid == -1) {
       [self install:completion];
       } else {
       [gself.launcher reload:^(NSError *error, NSInteger pid) {
       completion(nil, NO, KBInstallTypeInstaller);
       }];
       }
       */
      [service install:^(NSError *error, BOOL installed) {
        KBLaunchServiceInstall *install = [[KBLaunchServiceInstall alloc] init];
        install.error = error;
        install.service = service;
        install.installed = installed;
        runCompletion(install);
      }];
    }];

  };
  rover.completion = completion;
  [rover run];
}


- (void)removeDirectory:(NSString *)directory error:(NSError **)error {
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:error];
  for (NSString *file in files) {
    [NSFileManager.defaultManager removeItemAtPath:[directory stringByAppendingPathComponent:file] error:error];
  }
  [NSFileManager.defaultManager removeItemAtPath:directory error:error];
}

+ (void)installHelper:(KBOnCompletion)completion {
  NSError *error = nil;
  if ([self installServiceWithName:@"keybase.Helper" error:&error]) {
    MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
    [helper sendRequest:@"load_kbfs" params:nil completion:completion];
  } else {
    if (!error) error = KBMakeError(-1, @"Failed to install helper");
    completion(error, nil);
  }
}

+ (BOOL)installServiceWithName:(NSString *)name error:(NSError **)error {
  AuthorizationRef authRef;
  OSStatus status = AuthorizationCreate(NULL, NULL, 0, &authRef);
  if (status != errAuthorizationSuccess) {
    if (error) *error = MPMakeError(status, @"Error creating auth");
    return NO;
  }

  AuthorizationItem authItem = {kSMRightBlessPrivilegedHelper, 0, NULL, 0};
  AuthorizationRights authRights = {1, &authItem};
  AuthorizationFlags flags =	kAuthorizationFlagDefaults | kAuthorizationFlagInteractionAllowed	| kAuthorizationFlagPreAuthorize | kAuthorizationFlagExtendRights;
  status = AuthorizationCopyRights(authRef, &authRights, kAuthorizationEmptyEnvironment, flags, NULL);
  if (status != errAuthorizationSuccess) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
    return NO;
  }

  CFErrorRef cerror = NULL;
  Boolean success = SMJobBless(kSMDomainSystemLaunchd, (__bridge CFStringRef)name, authRef, &cerror);
  if (!success) {
    if (error) *error = (NSError *)CFBridgingRelease(cerror);
    return NO;
  } else {
    return YES;
  }
}

- (void)installDebugMocks {
  // TODO Remove from release
  NSString *recordZip = [[NSBundle mainBundle] pathForResource:@"record" ofType:@"zip"];
  NSString *recordDir = [AppDelegate applicationSupport:@[@"Record"] create:NO error:nil];
  //[self removeDirectory:recordDir error:nil];
  //[NSFileManager.defaultManager createDirectoryAtPath:recordDir withIntermediateDirectories:YES attributes:nil error:nil];
  NSTask *task = [[NSTask alloc] init];
  task.currentDirectoryPath = recordDir;
  task.launchPath = @"/usr/bin/unzip";
  task.arguments = @[recordZip];
  task.standardOutput = nil;
  task.standardError = nil;
  task.terminationHandler = ^(NSTask *t) {
    DDLogDebug(@"Task %@ exited with status: %@", t, @(t.terminationStatus));
  };
  [task launch];
}

@end
