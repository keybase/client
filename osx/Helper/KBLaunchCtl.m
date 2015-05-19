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

+ (void)reload:(NSString *)plist label:(NSString *)label completion:(KBOnLaunchStatus)completion {
  [self unload:plist label:label disable:NO completion:^(NSError *unloadError, NSString *unloadOutput) {
    [self load:plist label:label force:YES completion:^(NSError *loadError, NSString *loadOutput) {
      [self status:label completion:^(KBServiceStatus *serviceStatus) {
        completion(serviceStatus);
      }];
    }];
  }];
}

+ (void)load:(NSString *)plist label:(NSString *)label force:(BOOL)force completion:(KBOnLaunchExecution)completion {
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"load"];
  if (force) [args addObject:@"-w"];
  [args addObject:plist];
  [self execute:@"/bin/launchctl" args:args completion:^(NSError *error, NSString *output) {
    KBLog(@"Output: %@", output);
    if (error) {
      completion(error, output);
      return;
    }
    [self waitForLoadWithLabel:label attempt:1 completion:^(NSError *error) {
      completion(error, output);
    }];
  }];
}

+ (void)unload:(NSString *)plist label:(NSString *)label disable:(BOOL)disable completion:(KBOnLaunchExecution)completion {
  NSParameterAssert(plist);
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"unload"];
  if (disable) [args addObject:@"-w"];
  [args addObject:plist];
  [self execute:@"/bin/launchctl" args:args completion:^(NSError *error, NSString *output) {
    KBLog(@"Output: %@", output);
    if (error) {
      completion(error, output);
      return;
    }
    [self waitForUnloadWithLabel:label attempt:1 completion:^(NSError *error) {
      completion(error, output);
    }];
  }];
}

+ (void)status:(NSString *)label completion:(KBOnLaunchStatus)completion {
  NSParameterAssert(label);
  [self execute:@"/bin/launchctl" args:@[@"list"] completion:^(NSError *error, NSString *output) {
    if (error) {
      completion([KBServiceStatus error:error]);
      return;
    }
    for (NSString *line in [output componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]]) {
      NSArray *info = [line componentsSeparatedByCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
      if ([info count] != 3) continue;
      if ([info[2] hasPrefix:label]) {
        NSNumber *pid = KBNumberFromString(info[0]);
        NSNumber *lastExitStatus = KBNumberFromString(info[1]);
        completion([KBServiceStatus serviceStatusWithPid:pid lastExitStatus:lastExitStatus label:label]);
        return;
      }
    }
    completion(nil); // Not found
  }];
}

+ (void)waitForUnloadWithLabel:(NSString *)label attempt:(NSInteger)attempt completion:(void (^)(NSError *error))completion {
  [self status:label completion:^(KBServiceStatus *status) {
    if (!status || !status.isRunning) {
      KBLog(@"%@ is not running (%@)", label, KBOr(status.info, @"-"));
      completion(nil);
    } else {
      if ((attempt + 1) >= 10) {
        completion(KBMakeError(-1, @"Wait unload timeout (launchctl)"));
      } else {
        KBLog(@"Waiting for unload (#%@)", @(attempt));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [self waitForUnloadWithLabel:label attempt:attempt+1 completion:completion];
        });
      }
    }
  }];
}

+ (void)waitForLoadWithLabel:(NSString *)label attempt:(NSInteger)attempt completion:(void (^)(NSError *error))completion {
  [self status:label completion:^(KBServiceStatus *status) {
    if (status && status.isRunning) {
      KBLog(@"%@ is running: %@", status.label, status.pid);
      completion(nil);
    } else {
      if ((attempt + 1) >= 10) {
        completion(KBMakeError(-1, @"Wait load timeout (launchctl)"));
      } else {
        KBLog(@"Waiting for load (#%@)", @(attempt));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [self waitForLoadWithLabel:label attempt:attempt+1 completion:completion];
        });
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
  [task setStandardError:outpipe];
  task.terminationHandler = ^(NSTask *t) {
    KBLog(@"Task: \"%@ %@\" (%@)", command, [args componentsJoinedByString:@" "], @(t.terminationStatus));
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
