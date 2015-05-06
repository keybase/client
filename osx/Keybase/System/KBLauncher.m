//
//  KBLaunchCtl.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLauncher.h"
#import "KBEnvironment.h"
#import "KBLaunchCtl.h"

@interface KBLauncher ()
@property KBEnvironment *environment;
@property NSString *plist;
@end

@implementation KBLauncher

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super init])) {
    _environment = environment;

    NSString *launchAgentDir = [[NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject] stringByAppendingPathComponent:@"LaunchAgents"];
    _plist = [launchAgentDir stringByAppendingPathComponent:NSStringWithFormat(@"%@.plist", _environment.launchdLabel)];
  }
  return self;
}

- (void)status:(KBLaunchStatus)completion {
  [KBLaunchCtl status:_environment.launchdLabel completion:completion];
}

+ (NSDictionary *)launchdPlistDictionaryForEnvironment:(KBEnvironment *)environment {
  if (!environment.launchdLabel) return nil;

  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase"];
  [args addObjectsFromArray:@[@"-H", environment.home]];

  if (environment.host) {
    [args addObjectsFromArray:@[@"-s", environment.host]];
  }

  if (environment.isDebugEnabled) {
    [args addObject:@"-d"];
  }

  // This is because there is a hard limit of 104 characters for the unix socket file length and if
  // we the default there is a chance it will be too long (if username is long).
  [args addObject:NSStringWithFormat(@"--socket-file=%@", environment.sockFile)];

  // Run service (this should be the last arg)
  [args addObject:@"service"];

  // Logging
  NSString *logDir = [@"~/Library/Logs/Keybase" stringByExpandingTildeInPath];
  // Need to create logging dir here because otherwise it might be created as root by launchctl.
  [NSFileManager.defaultManager createDirectoryAtPath:logDir withIntermediateDirectories:YES attributes:nil error:nil];

  return @{
           @"Label": environment.launchdLabel,
           @"ProgramArguments": args,
           @"KeepAlive": @YES,
           @"StandardOutPath": NSStringWithFormat(@"%@/%@.log", logDir, environment.launchdLabel),
           @"StandardErrorPath": NSStringWithFormat(@"%@/%@.err", logDir, environment.launchdLabel),
           };
}

+ (NSString *)launchdPlistForEnvironment:(KBEnvironment *)environment error:(NSError **)error {
  NSData *data = [NSPropertyListSerialization dataWithPropertyList:[self launchdPlistDictionaryForEnvironment:environment] format:NSPropertyListXMLFormat_v1_0 options:0 error:error];
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (void)installLaunchAgent:(KBCompletion)completion {
  // Install launch agent (if not installed)
  NSString *plistDest = self.plist;
  if (!plistDest) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent destination.", nil);
    completion(error);
    return;
  }

  //
  // TODO
  // Only install if not exists or upgrade. We are currently always installing/updating the plist.
  //
  //if (![NSFileManager.defaultManager fileExistsAtPath:launchAgentPlistDest]) {
  NSError *error = nil;

  // Remove if exists
  if ([NSFileManager.defaultManager fileExistsAtPath:plistDest]) {
    if (![NSFileManager.defaultManager removeItemAtPath:plistDest error:&error]) {
      if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to remove existing luanch agent plist for upgrade.", nil);
      completion(error);
      return;
    }
  }

  NSDictionary *plistDict = [self.class launchdPlistDictionaryForEnvironment:_environment];
  NSData *data = [NSPropertyListSerialization dataWithPropertyList:plistDict format:NSPropertyListXMLFormat_v1_0 options:0 error:&error];
  if (!data) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to create plist data.", nil);
    completion(error);
    return;
  }

  if (![data writeToFile:plistDest atomically:YES]) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to create launch agent plist.", nil);
    completion(error);
    return;
  }

  // We installed the launch agent plist
  DDLogDebug(@"Installed launch agent plist");

  [KBLaunchCtl reload:plistDest label:_environment.launchdLabel completion:^(NSError *error, NSInteger pid) {
    completion(error);
  }];
}

//- (void)checkLaunch:(void (^)(NSError *error))completion {
//  launch_data_t config = launch_data_alloc(LAUNCH_DATA_DICTIONARY);
//
//  launch_data_t val;
//  val = launch_data_new_string("keybase.keybased");
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_LABEL);
//  val = launch_data_new_string("/Applications/Keybase.app/Contents/MacOS/keybased");
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_PROGRAM);
//  val = launch_data_new_bool(YES);
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_KEEPALIVE);
//
//  launch_data_t msg = launch_data_alloc(LAUNCH_DATA_DICTIONARY);
//  launch_data_dict_insert(msg, config, LAUNCH_KEY_SUBMITJOB);
//
//  launch_data_t response = launch_msg(msg);
//  if (!response) {
//    NSError *error = KBMakeErrorWithRecovery(-1, @"Launchd Error", @"Unable to launch keybased agent.", nil);
//    completion(error);
//  } else if (response && launch_data_get_type(response) == LAUNCH_DATA_ERRNO) {
//    //strerror(launch_data_get_errno(response))
//    //NSError *error = KBMakeErrorWithRecovery(-1, @"Launchd Error", @"Unable to launch keybased agent (LAUNCH_DATA_ERRNO).", nil);
//    //completion(error);
//    completion(nil);
//  } else {
//    completion(nil);
//  }
//}

@end
