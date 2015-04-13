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
    [_dateFormatter setDateFormat:@"dd.MM.yyyy HH:mm:ss:SSS"];
  }
  return self;
}

- (NSString *)formatLogMessage:(DDLogMessage *)logMessage {
  NSString *level;
  switch (logMessage.flag) {
    case DDLogFlagError : level = @"ERR  "; break;
    case DDLogFlagWarning : level = @"WARN "; break;
    case DDLogFlagInfo : level = @"INFO "; break;
    default : level = @"     "; break;
  }

  NSString *dateAndTime = [_dateFormatter stringFromDate:logMessage.timestamp];
  return [NSString stringWithFormat:@"%@ %@ %@ (%@): %@", level, dateAndTime, logMessage.fileName, @(logMessage.line), logMessage.message];
}


@end
