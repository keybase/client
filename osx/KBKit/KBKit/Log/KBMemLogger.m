//
//  KBMemLogger.m
//  KBKit
//
//  Created by Gabriel on 1/7/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBDefines.h"
#import "KBMemLogger.h"
#import "KBLogFormatter.h"

@interface KBMemLogger ()
@property NSMutableArray *buffer;
@property dispatch_group_t group;
@property dispatch_queue_t bufferQueue;
@end

@implementation KBMemLogger

- (instancetype)init {
  if ((self = [super init])) {
    _buffer = [NSMutableArray array];
    _group = dispatch_group_create();
    _bufferQueue = dispatch_queue_create("KBMemLogger", NULL);
    self.logFormatter = [[KBLogPlainFormatter alloc] init];
  }
  return self;
}

- (void)logMessage:(DDLogMessage *)logMessage {
  GHWeakSelf gself = self;
  dispatch_group_async(_group, _bufferQueue, ^{
    NSString *message = [gself.logFormatter formatLogMessage:logMessage];
    [gself.buffer addObject:message];
  });
}

- (void)clear {
  dispatch_group_async(_group, _bufferQueue, ^{
    [_buffer removeAllObjects];
  });
}

- (NSString *)messages {
  __block NSString *joined = nil;
  dispatch_group_async(_group, _bufferQueue, ^{
    joined = [_buffer join:@"\n"];
  });
  dispatch_group_wait(_group, DISPATCH_TIME_FOREVER);
  return joined;
}

@end
