//
//  KBInstallable.h
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBEnvConfig.h>
#import <KBKit/KBDefines.h>
#import <KBKit/KBComponentStatus.h>

// Default timeout for running (external) install (or status) commands
extern const NSTimeInterval KBDefaultTaskTimeout;

typedef void (^KBRefreshComponentCompletion)(KBComponentStatus *componentStatus);

@interface KBInstallable : NSObject

@property (readonly) NSString *name;

@property (readonly) KBEnvConfig *config;

@property (nonatomic) KBComponentStatus *componentStatus;
@property NSError *error;

- (instancetype)initWithConfig:(KBEnvConfig *)config name:(NSString *)name;

- (void)install:(KBCompletion)completion;
- (void)uninstall:(KBCompletion)completion;
- (void)refreshComponent:(KBRefreshComponentCompletion)completion;

- (NSArray *)installDescription:(NSString *)delimeter;
- (NSArray *)statusDescription:(NSString *)delimeter;

+ (NSError *)combineErrors:(NSArray *)installables ignoreWarnings:(BOOL)ignoreWarnings;

@end
