//
//  KBInstallStatusView.h
//  KBKit
//
//  Created by Gabriel on 1/6/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBEnvironment.h"
#import "KBMemLogger.h"


typedef NS_ENUM (NSInteger, KBInstallStatusSelect) {
  KBInstallStatusSelectQuit,
  KBInstallStatusSelectSkip,
  KBInstallStatusSelectRefresh,
  KBInstallStatusSelectReinstall,
  KBInstallStatusSelectControlPanel,
};

typedef void (^KBInstallStatusOnSelect)(KBInstallStatusSelect select);

@interface KBInstallStatusView : YOView

@property KBNavigationView *navigation;
@property (nonatomic) KBEnvironment *environment;
@property KBMemLogger *log;

@property (copy) KBInstallStatusOnSelect onSelect;

- (void)setDebugOptionsViewEnabled:(BOOL)debugOptionsViewEnabled;

- (void)setTitle:(NSString *)title headerText:(NSString *)headerText;

- (void)refreshInstallables;

- (void)setButtons:(NSArray *)buttons;

- (void)refresh;

- (void)install;

- (void)share:(id)sender completion:(dispatch_block_t)completion;

- (void)clear;

@end
