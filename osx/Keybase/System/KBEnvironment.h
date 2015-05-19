//
//  KBEnvironment.h
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBEnv) {
  KBEnvLocalhost,
  KBEnvKeybaseIO,
};

@interface KBEnvironment : NSObject

@property (readonly) NSString *homeDir;
@property (readonly) NSString *host;
@property (readonly, getter=isDebugEnabled) BOOL debugEnabled;
@property (readonly) NSString *mountDir;
@property (readonly) NSString *sockFile;
@property (readonly) NSString *identifier;
@property (readonly, getter=isLaunchdEnabled) BOOL launchdEnabled;
@property (readonly) NSString *launchdLabelService;
@property (readonly) NSString *launchdLabelKBFS;
@property (readonly) NSString *title;
@property (readonly) NSString *info;
@property (readonly) NSImage *image;
@property (readonly, getter=isInstallEnabled) BOOL installEnabled; // Whether to attempt install

- (instancetype)initWithEnv:(KBEnv)env;

- (instancetype)initWithHomeDir:(NSString *)homeDir sockFile:(NSString *)sockFile;

+ (instancetype)env:(KBEnv)env;

+ (NSString *)defaultSockFileForHomeDir:(NSString *)homeDir;

- (NSDictionary *)launchdPlistDictionaryForService;
- (NSDictionary *)launchdPlistDictionaryForKBFS;

- (NSString *)commandLineForService:(BOOL)tilde;
- (NSString *)commandLineForKBFS:(BOOL)tilde;

- (NSString *)cachePath:(NSString *)filename;

@end
