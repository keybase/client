//
//  KBMemLogger.h
//  KBKit
//
//  Created by Gabriel on 1/7/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBMemLogger : NSObject <DDLogger>

@property (nonatomic, strong) id <DDLogFormatter> logFormatter;

- (NSString *)messages;
- (void)clear;

@end
