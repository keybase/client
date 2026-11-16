//
//  KBLogFormatter.m
//  Keybase
//
//  Created by Gabriel on 4/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLogFormatter.h"

@interface KBLogFormatter ()
@property NSDateFormatter *dateFormatter;
@end

@implementation KBLogFormatter

- (id)init {
  if ((self = [super init])) {
    _dateFormatter = [[NSDateFormatter alloc] init];
    [_dateFormatter setFormatterBehavior:NSDateFormatterBehavior10_4];
    [_dateFormatter setDateFormat:@"MM.dd.yyyy HH:mm:ss.SSS"];
  }
  return self;
}

- (NSString *)formatLogMessage:(DDLogMessage *)logMessage {
  NSString *dateAndTime = [_dateFormatter stringFromDate:logMessage.timestamp];
  return [NSString stringWithFormat:@"%@ %@:%@%@ %@", dateAndTime, logMessage.fileName, @(logMessage.line), [KBLogFormatter flagsFromLogMessage:logMessage], logMessage.message];
}

+ (NSString *)flagsFromLogMessage:(DDLogMessage *)logMessage {
  NSMutableArray *flags = [NSMutableArray array];
  if (logMessage.flag & DDLogFlagError) [flags addObject:@"ERROR"];
  if (logMessage.flag & DDLogFlagWarning) [flags addObject:@"WARN"];
  if (logMessage.flag & DDLogFlagInfo) [flags addObject:@"INFO"];
  if (logMessage.flag & DDLogFlagDebug) [flags addObject:@"DEBG"];
  if (logMessage.flag & DDLogFlagVerbose) [flags addObject:@"VERB"];
  return [NSString stringWithFormat:@"[%@]", [flags componentsJoinedByString:@","]];
}

@end
