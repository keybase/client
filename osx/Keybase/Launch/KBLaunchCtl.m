//
//  KBLaunchCtl.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLaunchCtl.h"


#define PLIST_PATH (@"keybase.keybased.plist")

@implementation KBLaunchCtl

- (void)reload:(KBLaunchExecution)completion {
  [self unload:^(NSError *unloadError, NSString *unloadOutput) {
    [self load:^(NSError *loadError, NSString *loadOutput) {
      // Give it a change to startup
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        completion(loadError, loadOutput);
      });
    }];
  }];
}

- (NSString *)plist {
  NSString *launchAgentDir = [[NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject] stringByAppendingPathComponent:@"LaunchAgents"];
  return [launchAgentDir stringByAppendingPathComponent:PLIST_PATH];
}

- (void)load:(KBLaunchExecution)completion {
  [self execute:@"/bin/launchctl" args:@[@"load", @"-w", self.plist] completion:completion];
}

- (void)unload:(KBLaunchExecution)completion {
  [self execute:@"/bin/launchctl" args:@[@"unload", self.plist] completion:completion];
}

- (void)status:(KBLaunchExecution)completion {
  [self execute:@"/bin/launchctl" args:@[@"list"] completion:^(NSError *error, NSString *output) {
    for (NSString *line in [output componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]]) {
      if ([line containsString:@"keybase.keybased"]) {
        completion(nil, line);
        return;
      }
    }
    completion(nil, nil);
  }];
}

- (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSString *output))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  NSPipe *outpipe = [NSPipe pipe];
  [task setStandardOutput:outpipe];
  task.terminationHandler = ^(NSTask *t) {
    GHDebug(@"Task %@ exited with status: %@", t, @(t.terminationStatus));
    NSFileHandle *read = [outpipe fileHandleForReading];
    NSData *data = [read readDataToEndOfFile];
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    dispatch_async(dispatch_get_main_queue(), ^{
      // TODO Check termination status and complete with error if > 0
      completion(nil, output);
    });
  };
  // Only do this for release versions?
  BOOL debug = NO;
#ifdef DEBUG
  debug = YES;
#endif

  _releaseOnly = NO;
  if (_releaseOnly && debug) {
    // Its release only and we are in debug
    completion(nil, nil);
  } else {
    [task launch];
  }
}

- (void)installLaunchAgent:(KBCompletionBlock)completion {
  // Install launch agent (if not installed)
  NSString *plist = self.plist;
  if (!plist) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent destination.", nil);
    completion(error);
    return;
  }

  //
  // TODO
  // Only install if not exists or upgrade. We are currently always installing/updating the plist.
  //
  //if (![NSFileManager.defaultManager fileExistsAtPath:launchAgentPlistDest]) {
  NSString *launchAgentPlistSource = [[NSBundle mainBundle] pathForResource:PLIST_PATH.stringByDeletingPathExtension ofType:PLIST_PATH.pathExtension];

  if (!launchAgentPlistSource) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent plist found in bundle.", nil);
    completion(error);
    return;
  }

  NSError *error = nil;

  // Remove if exists
  if ([NSFileManager.defaultManager fileExistsAtPath:plist]) {
    if (![NSFileManager.defaultManager removeItemAtPath:plist error:&error]) {
      if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to remove existing luanch agent plist for upgrade.", nil);
      completion(error);
      return;
    }
  }

  if (![NSFileManager.defaultManager copyItemAtPath:launchAgentPlistSource toPath:plist error:&error]) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to transfer launch agent plist.", nil);
    completion(error);
    return;
  }

  // We installed the launch agent plist
  GHDebug(@"Installed");

  [self checkLaunch:plist completion:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    // Success
    completion(nil);
  }];
}

- (void)checkLaunch:(NSString *)path completion:(void (^)(NSError *error))completion {
  [self reload:^(NSError *error, NSString *output) {
    completion(nil);
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
