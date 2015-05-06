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
#import "KBLaunchCtl.h"
#import <ServiceManagement/ServiceManagement.h>

@interface KBInstaller ()
@property KBLaunchCtl *launchCtl;
@end

@implementation KBInstaller

- (instancetype)initWithLaunchCtl:(KBLaunchCtl *)launchCtl {
  if ((self = [super init])) {
    _launchCtl = launchCtl;
  }
  return self;
}

- (void)checkInstall:(KBInstallCheck)completion {
  if (!_launchCtl) {
    completion(nil, NO, KBInstallTypeNone);
    return;
  }

  [_launchCtl status:^(NSError *error, NSInteger pid) {
    if (error) {
      completion(error, NO, KBInstallTypeNone);
      return;
    }
    /*
    if (pid == -1) {
      [self install:completion];
    } else {
      [gself.launchCtl reload:^(NSError *error, NSInteger pid) {
        completion(nil, NO, KBInstallTypeInstaller);
      }];
    }
     */
    [self install:completion];
  }];
}

- (void)install:(void (^)(NSError *error, BOOL installed, KBInstallType installType))completion {
  NSError *error = nil;
  [AppDelegate applicationSupport:nil create:YES error:&error]; // Create application support dir
  if (error) {
    completion(error, NO, KBInstallTypeNone);
    return;
  }

  [_launchCtl installLaunchAgent:^(NSError *error) {
    if (error) {
      completion(error, NO, KBInstallTypeNone);
      return;
    }
    completion(error, YES, KBInstallTypeInstaller);
  }];
}

- (void)removeDirectory:(NSString *)directory error:(NSError **)error {
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:error];
  for (NSString *file in files) {
    [NSFileManager.defaultManager removeItemAtPath:[directory stringByAppendingPathComponent:file] error:error];
  }
  [NSFileManager.defaultManager removeItemAtPath:directory error:error];
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
