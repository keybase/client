//
//  KBEnvironment.h
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBEnv) {
  KBEnvManual = 1,
  KBEnvLocalhost,
  KBEnvKeybaseIO,
};

@interface KBEnvironment : NSObject

@property NSString *home;
@property NSString *host;
@property NSString *launchDLabel;
@property (getter=isDebugEnabled) BOOL debugEnabled;

@property NSString *sockFile;

@property NSString *title;
@property BOOL canRunFromXCode;

- (instancetype)initWithEnv:(KBEnv)env;

+ (instancetype)env:(KBEnv)env;

@end
