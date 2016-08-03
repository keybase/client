//
//  KBLaunchCtl.m
//  Keybase
//
//  Created by Gabriel on 5/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLaunchCtl.h"
#import "KBDefines.h"
#import "KBTask.h"

@implementation KBLaunchCtl

+ (void)reload:(NSString *)plist label:(NSString *)label completion:(KBOnLaunchCtlStatus)completion {
  [self unload:plist label:label disable:NO completion:^(NSError *unloadError, NSString *unloadOutput) {
    [self load:plist label:label force:YES completion:^(NSError *loadError, NSString *loadOutput) {
      [self status:label completion:^(KBLaunchdStatus *serviceStatus) {
        completion(serviceStatus);
      }];
    }];
  }];
}

+ (void)load:(NSString *)plist label:(NSString *)label force:(BOOL)force completion:(KBOnLaunchCtlExecution)completion {
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"load"];
  if (force) [args addObject:@"-w"];
  [args addObject:plist];
  DDLogDebug(@"Loading %@", label);
  [self execute:@"/bin/launchctl" args:args timeout:5 completion:^(NSError *error, NSData *data) {
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    DDLogDebug(@"Output: %@", output);
    if (error) {
      completion(error, output);
      return;
    }
    [self waitForLoadWithLabel:label attempt:1 completion:^(NSError *error) {
      completion(error, output);
    }];
  }];
}

+ (void)unload:(NSString *)plist label:(NSString *)label disable:(BOOL)disable completion:(KBOnLaunchCtlExecution)completion {
  NSParameterAssert(plist);
  NSMutableArray *args = [NSMutableArray array];
  [args addObject:@"unload"];
  if (disable) [args addObject:@"-w"];
  [args addObject:plist];
  DDLogDebug(@"Unloading %@", label);
  [self execute:@"/bin/launchctl" args:args timeout:5 completion:^(NSError *error, NSData *data) {
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    DDLogDebug(@"Output: %@", output);
    if (error) {
      completion(error, output);
      return;
    }
    if (label) {
      [self waitForUnloadWithLabel:label attempt:1 completion:^(NSError *error) {
        completion(error, output);
      }];
    } else {
      completion(nil, output);
    }
  }];
}

+ (void)status:(NSString *)label completion:(KBOnLaunchCtlStatus)completion {
  NSParameterAssert(label);
  DDLogDebug(@"Checking launchd status for %@", label);
  [self execute:@"/bin/launchctl" args:@[@"list"] timeout:5 completion:^(NSError *error, NSData *data) {
    if (error) {
      completion([KBLaunchdStatus error:error]);
      return;
    }
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    for (NSString *line in [output componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]]) {
      NSArray *info = [line componentsSeparatedByCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
      if ([info count] != 3) continue;
      if ([info[2] isEqualTo:label]) {
        NSNumber *pid = KBNumberFromString(info[0]);
        // Only parse exit status if PID is not set
        NSNumber *lastExitStatus = !pid ? KBNumberFromString(info[1]) : nil;
        completion([KBLaunchdStatus serviceStatusWithPid:pid lastExitStatus:lastExitStatus label:label]);
        return;
      }
    }
    completion(nil); // Not found
  }];
}

+ (void)waitForUnloadWithLabel:(NSString *)label attempt:(NSInteger)attempt completion:(void (^)(NSError *error))completion {
  [self status:label completion:^(KBLaunchdStatus *status) {
    if (!status || !status.isRunning) {
      DDLogDebug(@"%@ is not running (%@)", label, KBOr(status.info, @"-"));
      completion(nil);
    } else {
      if ((attempt + 1) >= 10) {
        completion(KBMakeError(KBErrorCodeTimeout, @"Wait unload timeout (launchctl)"));
      } else {
        DDLogDebug(@"Waiting for unload (#%@)", @(attempt));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [self waitForUnloadWithLabel:label attempt:attempt+1 completion:completion];
        });
      }
    }
  }];
}

+ (void)waitForLoadWithLabel:(NSString *)label attempt:(NSInteger)attempt completion:(void (^)(NSError *error))completion {
  [self status:label completion:^(KBLaunchdStatus *status) {
    if (status && status.isRunning) {
      DDLogDebug(@"%@ is running: %@", status.label, status.pid);
      completion(nil);
    } else {
      if ((attempt + 1) >= 10) {
        completion(KBMakeError(KBErrorCodeTimeout, @"Wait load timeout (launchctl)"));
      } else {
        DDLogDebug(@"Waiting for load (#%@)", @(attempt));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [self waitForLoadWithLabel:label attempt:attempt+1 completion:completion];
        });
      }
    }
  }];
}

+ (void)execute:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, NSData *data))completion {
  [KBTask execute:command args:args timeout:timeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    // TODO outData or errData?
    completion(error, outData);
  }];
}

@end
