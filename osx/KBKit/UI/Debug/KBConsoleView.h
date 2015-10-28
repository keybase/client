//
//  KBConsoleView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

typedef NS_ENUM (NSInteger, KBConsoleType) {
  KBConsoleTypeApp,
  KBConsoleTypeService
};

@interface KBConsoleView : YOVBox <DDLogger>

@property (nonatomic) id<DDLogFormatter> logFormatter;

- (void)logMessage:(DDLogMessage *)logMessage;

@end
