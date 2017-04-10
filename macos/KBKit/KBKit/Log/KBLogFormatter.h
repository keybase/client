//
//  KBLogFormatter.h
//  Keybase
//
//  Created by Gabriel on 4/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBLogFormatter : NSObject <DDLogFormatter>
@end

@interface KBLogPlainFormatter : NSObject <DDLogFormatter>
@end

@interface KBLogConsoleFormatter : NSObject <DDLogFormatter>
@end
