//
//  KBTask.m
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBTask.h"

#import "KBDefines.h"

@implementation KBTask

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  NSPipe *outPipe = [NSPipe pipe];
  [task setStandardOutput:outPipe];
  NSPipe *errPipe = [NSPipe pipe];
  [task setStandardError:errPipe];
  task.terminationHandler = ^(NSTask *t) {
    //DDLogDebug(@"Task: \"%@ %@\" (%@)", command, [args componentsJoinedByString:@" "], @(t.terminationStatus));
    NSFileHandle *outRead = [outPipe fileHandleForReading];
    NSData *outData = [outRead readDataToEndOfFile];
    NSFileHandle *errRead = [errPipe fileHandleForReading];
    NSData *errData = [errRead readDataToEndOfFile];
    dispatch_async(dispatch_get_main_queue(), ^{
      // TODO Check termination status and complete with error if > 0
      DDLogDebug(@"Task (done): %@, %@", @(t.terminationStatus), @(t.terminationReason));
      if ([outData length] > 0) {
        DDLogDebug(@"Task (out): %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
      }
      if ([errData length] > 0) {
        DDLogDebug(@"Task (err): %@", [[NSString alloc] initWithData:errData encoding:NSUTF8StringEncoding]);
      }

      completion(nil, outData, errData);
    });
  };

  @try {
    DDLogDebug(@"Task: %@ %@", command, [args join:@" "]);
    [task launch];
  } @catch (NSException *e) {
    NSString *errorMessage = NSStringWithFormat(@"%@ (%@ %@)", e.reason, command, [args join:@" "]);
    DDLogError(@"Error running task: %@", errorMessage);
    completion(KBMakeError(KBErrorCodeGeneric, @"%@", errorMessage), nil, nil);
  }
}

+ (void)executeForJSONWithCommand:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, id value))completion {
  [self execute:command args:args completion:^(NSError *error, NSData *outData, NSData *errData) {
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

@end
