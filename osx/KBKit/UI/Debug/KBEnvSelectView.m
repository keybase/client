//
//  KBEnvSelectView.m
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBEnvSelectView.h"

#import "KBButtonView.h"
#import "KBEnvironment.h"
#import "KBHeaderLabelView.h"
#import "KBCustomEnvView.h"
#import "KBWorkspace.h"

#import "KBService.h"
#import "KBFSService.h"
#import "KBInstaller.h"

#import <KBAppKit/KBAppKit.h>

@interface KBEnvSelectView ()
@property KBSplitView *splitView;
@property KBListView *listView;
@property KBCustomEnvView *customView;
@end

@implementation KBEnvSelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Choose an Environment" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self addSubview:header];

  _splitView = [[KBSplitView alloc] init];
  _splitView.dividerPosition = 300;
  _splitView.divider.hidden = YES;
  _splitView.rightInsets = UIEdgeInsetsMake(0, 20, 0, 0);
  [self addSubview:_splitView];

  GHWeakSelf gself = self;
  _listView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:0];
  _listView.scrollView.borderType = NSBezelBorder;
  _listView.onSet = ^(KBImageTextView *label, KBEnvConfig *envConfig, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:envConfig.title info:envConfig.info image:envConfig.image lineBreakMode:NSLineBreakByClipping];
  };
  _listView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    [gself select:selection.object];
  };
  [_splitView setLeftView:_listView];

  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [self addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Next" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ [gself next]; };
  [buttons addSubview:nextButton];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_splitView top:@[header] bottom:@[buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];

  _customView = [[KBCustomEnvView alloc] init];

  NSArray *envConfigs = @[
                          [KBEnvConfig envConfigWithRunMode:KBRunModeProd],
                          [KBEnvConfig envConfigWithRunMode:KBRunModeStaging],
                          [KBEnvConfig envConfigWithRunMode:KBRunModeDevel],
                          [KBEnvConfig envConfigFromUserDefaults:[KBWorkspace userDefaults]],
                    ];
  [_listView setObjects:envConfigs animated:NO];

  NSString *title = [[KBWorkspace userDefaults] objectForKey:@"Env"];
  KBEnvironment *selected = [envConfigs detect:^BOOL(KBEnvConfig *c) { return [c.title isEqualToString:title]; }];
  if (selected) [_listView setSelectedRow:[envConfigs indexOfObject:selected]];
  else [_listView setSelectedRow:[_listView.dataSource countForSection:0] - 1];
}

- (void)select:(KBEnvConfig *)envConfig {
  [_splitView setRightView:[self viewForEnvConfig:envConfig]];
}

- (void)next {
  KBEnvConfig *envConfig = _listView.selectedObject;
  [self selectEnvConfig:envConfig];
}

/*
- (void)checkHomebrew:(void (^)(BOOL exists))completion {
  NSString *launchAgentDir = [[NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject] stringByAppendingPathComponent:@"LaunchAgents"];
  NSString *plistDest = [launchAgentDir stringByAppendingPathComponent:@"homebrew.mxcl.keybase.plist"];

  if ([NSFileManager.defaultManager fileExistsAtPath:plistDest isDirectory:nil]) {
    completion(YES);
    return;
    //[KBLaunchCtl status:@"homebrew.mxcl.keybase" completion:^(KBServiceStatus *serviceStatus) { completion(serviceStatus); }];
  }

  completion(NO);
}
 */

- (void)selectEnvConfig:(KBEnvConfig *)envConfig {
  NSUserDefaults *userDefaults = [KBWorkspace userDefaults];
  [userDefaults setObject:envConfig.title forKey:@"Env"];
  [userDefaults synchronize];

  if ([envConfig.title isEqualToString:@"Custom"]) {
    envConfig = [_customView config];
    [envConfig saveToUserDefaults:[KBWorkspace userDefaults]];
    NSError *error = nil;
    if (![envConfig validate:&error]) {
      [KBActivity setError:error sender:self];
      return;
    }
    self.onSelect(envConfig);
  } else if (envConfig.runMode == KBRunModeProd) {
    [KBActivity setError:KBMakeError(KBErrorCodeUnsupported, @"Not supported yet") sender:self];
  } else {
    self.onSelect(envConfig);
  }
}

- (NSView *)viewForEnvConfig:(KBEnvConfig *)envConfig {
  if ([envConfig.title isEqualToString:@"Custom"]) {
    [_customView setConfig:envConfig];
    return _customView;
  }

  YOVBox *view = [YOVBox box:@{@"spacing": @(10), @"insets": @(10)}];
  [view kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  YOVBox *labels = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];
  [view addSubview:labels];

  typedef NSView * (^KBCreateEnvInfoLabel)(NSString *key, NSString *value);

  KBCreateEnvInfoLabel createView = ^NSView *(NSString *key, NSString *value) {
    KBHeaderLabelView *view = [KBHeaderLabelView headerLabelViewWithHeader:key headerOptions:0 text:value style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByCharWrapping];
    view.columnWidth = 120;
    return view;
  };

  [labels addSubview:createView(@"Run Mode", NSStringFromKBRunMode(envConfig.runMode, NO))];
  if (envConfig.mountDir) [labels addSubview:createView(@"Mount", [KBPath path:envConfig.mountDir options:KBPathOptionsTilde])];

  if (envConfig.sockFile) {
    [labels addSubview:createView(@"Connect", envConfig.sockFile)];
  }

  return view;
}

@end
