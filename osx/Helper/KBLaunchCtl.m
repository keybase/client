//
//  KBLaunchCtl.m
//  Keybase
//
//  Created by Gabriel on 5/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLaunchCtl.h"
#import "KBHelperDefines.h"

@implementation KBLaunchCtl

+ (void)reload:(NSString *)plist label:(NSString *)label completion:(KBLaunchStatus)completion {
  [self unload:plist disable:NO completion:^(NSError *unloadError, NSString *unloadOutput) {
    [self wait:label load:NO attempt:1 completion:^(NSError *error, NSInteger pid) {
      [self load:plist force:YES completion:^(NSError *loadError, NSString *loadOutput) {
        [self wait:label load:YES attempt:1 completion:^(NSError *error, NSInteger pid) {
          completion(loadError, pid);
        }];
      }];
    }];
  }];
}

+ (void)load:(NSString *)plist force:(BOOL)force completion:(KBLaunchExecution)completion {
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"load"];
  if (force) [args addObject:@"-w"];
  [args addObject:plist];
  [self execute:@"/bin/launchctl" args:args completion:completion];
}

+ (void)unload:(NSString *)plist disable:(BOOL)disable completion:(KBLaunchExecution)completion {
  NSParameterAssert(plist);
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"unload"];
  if (disable) [args addObject:@"-w"];
  [args addObject:plist];
  [self execute:@"/bin/launchctl" args:args completion:completion];
}

+ (void)status:(NSString *)label completion:(KBLaunchStatus)completion {
  NSParameterAssert(label);
  [self execute:@"/bin/launchctl" args:@[@"list"] completion:^(NSError *error, NSString *output) {
    if (error) {
      completion(error, -1);
      return;
    }
    for (NSString *line in [output componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]]) {
      // TODO better parsing
      if ([line containsString:label]) {
        NSInteger pid = [[[line componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]] firstObject] integerValue];
        completion(nil, pid);
        return;
      }
    }
    completion(nil, -1);
  }];
}

+ (void)wait:(NSString *)label load:(BOOL)load attempt:(NSInteger)attempt completion:(KBLaunchStatus)completion {
  [self status:label completion:^(NSError *error, NSInteger pid) {
    if (load && pid != 0) {
      KBLog(@"Pid: %@", @(pid));
      completion(nil, pid);
    } else if (!load && pid == 0) {
      completion(nil, pid);
    } else {
      if ((attempt + 1) >= 4) {
        completion(KBMakeError(-1, @"launchctl wait timeout"), 0);
      } else {
        KBLog(@"Waiting for %@ (%@)", load ? @"load" : @"unload", @(attempt));
        [self wait:label load:load attempt:attempt+1 completion:completion];
      }
    }
  }];
}

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSString *output))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  NSPipe *outpipe = [NSPipe pipe];
  [task setStandardOutput:outpipe];
  task.terminationHandler = ^(NSTask *t) {
    KBLog(@"Task %@ exited with status: %@", t, @(t.terminationStatus));
    NSFileHandle *read = [outpipe fileHandleForReading];
    NSData *data = [read readDataToEndOfFile];
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    dispatch_async(dispatch_get_main_queue(), ^{
      // TODO Check termination status and complete with error if > 0
      completion(nil, output);
    });
  };
  [task launch];
}

@end
