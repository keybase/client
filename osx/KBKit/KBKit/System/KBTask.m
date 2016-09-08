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

@interface KBTask ()
@property dispatch_queue_t taskQueue;
@end

@interface KBTaskReader : NSObject
@property NSFileHandle *outFh;
@property NSFileHandle *errFh;
@property NSMutableData *outData;
@property NSMutableData *errData;
- (instancetype)initWithTask:(NSTask *)task;
- (void)start;
- (void)readToEOF;
@end

@implementation KBTask

+ (void)execute:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion {
  KBTask *task = [[KBTask alloc] init];
  [task execute:command args:args timeout:timeout completion:completion];
}

- (instancetype)init {
  if ((self = [super init])) {
    self.taskQueue = dispatch_queue_create("taskQueue", NULL);
  }
  return self;
}

- (void)execute:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  [task setStandardInput:[NSPipe pipe]];

  KBTaskReader *taskReader = [[KBTaskReader alloc] initWithTask:task];
  [taskReader start];

  __block BOOL replied = NO;
  __block BOOL timedOut = NO;
  if (timeout > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, timeout * NSEC_PER_SEC), self.taskQueue, ^{
      if (!replied) {
        timedOut = YES;

        NSString *taskDesc = NSStringWithFormat(@"%@ %@", command, [args join:@" "]);
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
      }
    });
  }

  task.terminationHandler = ^(NSTask *t) {
    dispatch_async(self.taskQueue, ^{
      if (timedOut) {
        DDLogDebug(@"Task termination handler, timed out, skipping");
        return;
      }
      replied = YES;
      DDLogDebug(@"Task dispatch completion");
      dispatch_async(dispatch_get_main_queue(), ^{
        // Ensure we have all the data
        [taskReader readToEOF];
        DDLogDebug(@"Task (out): %@", [[NSString alloc] initWithData:taskReader.outData encoding:NSUTF8StringEncoding]);
        DDLogDebug(@"Task (err): %@", [[NSString alloc] initWithData:taskReader.errData encoding:NSUTF8StringEncoding]);
        completion(nil, taskReader.outData, taskReader.errData);
      });
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
  KBTask *task = [[KBTask alloc] init];
  [task executeForJSONWithCommand:command args:args timeout:timeout completion:completion];
}


- (void)executeForJSONWithCommand:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, id value))completion {
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

@end

@implementation KBTaskReader

- (instancetype)initWithTask:(NSTask *)task {
  if ((self = [super init])) {
    NSPipe *outPipe = [NSPipe pipe];
    [task setStandardOutput:outPipe];
    NSPipe *errPipe = [NSPipe pipe];
    [task setStandardError:errPipe];

    self.outFh = [outPipe fileHandleForReading];
    self.outData = [NSMutableData data];
    GHWeakSelf wself = self;
    [[NSNotificationCenter defaultCenter] addObserverForName:NSFileHandleReadToEndOfFileCompletionNotification object:self.outFh queue:nil usingBlock:^(NSNotification *notification) {
      [wself outData:notification];
    }];

    self.errFh = [errPipe fileHandleForReading];
    self.errData = [NSMutableData data];
    [[NSNotificationCenter defaultCenter] addObserverForName:NSFileHandleReadToEndOfFileCompletionNotification object:self.errFh queue:nil usingBlock:^(NSNotification *notification) {
      [wself errData:notification];
    }];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self name:NSFileHandleReadToEndOfFileCompletionNotification object:self.outFh];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:NSFileHandleReadToEndOfFileCompletionNotification object:self.errFh];
}

- (void)start {
  [self.outFh readToEndOfFileInBackgroundAndNotify];
  [self.errFh readToEndOfFileInBackgroundAndNotify];
}

- (void)readToEOF {
  NSData *outData = [self.outFh readDataToEndOfFile];
  if (outData.length > 0) {
    [self.outData appendData:outData];
  }
  NSData *errData = [self.errFh readDataToEndOfFile];
  if (errData.length > 0) {
    [self.errData appendData:errData];
  }
}

- (void)outData:(NSNotification *)notification {
  NSData *data = [[notification userInfo] objectForKey:NSFileHandleNotificationDataItem];
  if (data.length > 0) {
    [self.outData appendData:data];
  }
}

- (void)errData:(NSNotification *)notification {
  NSData *data = [[notification userInfo] objectForKey:NSFileHandleNotificationDataItem];
  if (data.length > 0) {
    [self.errData appendData:data];
  }
}

@end