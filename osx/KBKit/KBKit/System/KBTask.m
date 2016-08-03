//
//  KBTask.m
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBTask.h"

#import "KBDefines.h"
#include <signal.h>

@implementation KBTask

+ (void)execute:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  [task setStandardInput:[NSPipe pipe]];
  NSPipe *outPipe = [NSPipe pipe];
  [task setStandardOutput:outPipe];
  NSPipe *errPipe = [NSPipe pipe];
  [task setStandardError:errPipe];

  dispatch_queue_t taskQueue = dispatch_queue_create("taskQueue", NULL);

  __block BOOL replied = NO;
  __block BOOL timedOut = NO;
  if (timeout > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, timeout * NSEC_PER_SEC), taskQueue, ^{
      if (!replied) {
        timedOut = YES;

        // Dump golang stack to log
        kill(task.processIdentifier, SIGABRT);

        NSString *taskDesc = NSStringWithFormat(@"%@ %@", command, [args join:@" "]);
        [self readOutPipe:outPipe errPipe:errPipe description:taskDesc completion:^(NSData *outData, NSData *errData) {
          DDLogError(@"Task timed out: %@", taskDesc);
          dispatch_async(dispatch_get_main_queue(), ^{
            completion(KBMakeError(KBErrorCodeTimeout, @"Task timed out: %@", taskDesc), nil, nil);
          });

          // Terminate/cleanup task after timeout
          @try {
            [task terminate];
          } @catch(NSException *e) {
            DDLogDebug(@"Task error in terminate after timeout: %@", e);
          }
        }];
      }
    });
  }

  task.terminationHandler = ^(NSTask *t) {
    dispatch_async(taskQueue, ^{
      NSString *taskDesc = NSStringWithFormat(@"%@ %@", command, [args join:@" "]);
      if (timedOut) {
        DDLogDebug(@"Task termination handler, timed out, skipping");
        return;
      }
      replied = YES;
      DDLogDebug(@"Task termination handler, reading output");
      [self readOutPipe:outPipe errPipe:errPipe description:taskDesc completion:^(NSData *outData, NSData *errData) {
        DDLogDebug(@"Task dispatch completion");
        dispatch_async(dispatch_get_main_queue(), ^{
          completion(nil, outData, errData);
        });
      }];
    });
  };

  @try {
    DDLogDebug(@"Task: %@ %@", command, [args join:@" "]);
    [task launch];
    [task waitUntilExit];
  } @catch (NSException *e) {
    NSString *errorMessage = NSStringWithFormat(@"%@ (%@ %@)", e.reason, command, [args join:@" "]);
    DDLogError(@"Error running task: %@", errorMessage);
    replied = YES;
    completion(KBMakeError(KBErrorCodeGeneric, @"%@", errorMessage), nil, nil);
  }
}

+ (void)executeForJSONWithCommand:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, id value))completion {
  [self execute:command args:args timeout:timeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (!outData) {
      completion(KBMakeError(KBErrorCodeGeneric, @"No data for launchd status"), nil);
      return;
    }

    id value = [NSJSONSerialization JSONObjectWithData:outData options:NSJSONReadingMutableContainers error:&error];
    if (error) {
      DDLogError(@"Invalid data: %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
      completion(error, nil);
      return;
    }
    if (!value) {
      completion(KBMakeError(KBErrorCodeGeneric, @"Invalid JSON"), nil);
      return;
    }

    completion(nil, value);
  }];
}

+ (void)readOutPipe:(NSPipe *)outPipe errPipe:(NSPipe *)errPipe description:(NSString *)description completion:(void (^)(NSData *outData, NSData *errData))completion {
  NSFileHandle *outRead = [outPipe fileHandleForReading];
  NSData *outData = [outRead readDataToEndOfFile];
  NSFileHandle *errRead = [errPipe fileHandleForReading];
  NSData *errData = [errRead readDataToEndOfFile];

  if ([outData length] > 0) {
    DDLogDebug(@"Task %@ (out): %@", description, [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
  }
  if ([errData length] > 0) {
    DDLogDebug(@"Task %@ (err): %@", description, [[NSString alloc] initWithData:errData encoding:NSUTF8StringEncoding]);
  }
  completion(outData, errData);
}

@end
