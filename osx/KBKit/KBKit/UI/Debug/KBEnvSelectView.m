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
#import "MDPSplitView.h"

#import <Tikppa/Tikppa.h>
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBEnvSelectView ()
@property MDPSplitView *splitView;
@property KBListView *listView;
@property KBCustomEnvView *customView;
@property YOView *rightView;
@end

@implementation KBEnvSelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Choose an Environment" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self addSubview:header];

  _splitView = [[MDPSplitView alloc] init];
  _splitView.vertical = YES;
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
  [_splitView addSubview:_listView];

  _rightView = [YOView view];
  [_splitView addSubview:_rightView];

  [_splitView adjustSubviews];

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

- (void)viewDidMoveToSuperview {
  [super viewDidMoveToSuperview];
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.splitView setPosition:250 ofDividerAtIndex:0 animated:NO];
  });
}

- (void)select:(KBEnvConfig *)envConfig {
  NSView *envView = [self viewForEnvConfig:envConfig];
  for (NSView *view in _rightView.subviews) [view removeFromSuperview];
  [_rightView addSubview:envView];
  _rightView.viewLayout = [YOLayout fill:envView];
}

- (void)next {
  KBEnvConfig *envConfig = _listView.selectedObject;
  [self selectEnvConfig:envConfig];
}

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
  } else if (envConfig.runMode == KBRunModeDevel) {
    [KBActivity setError:KBMakeError(KBErrorCodeUnsupported, @"Use Staging or Custom instead.") sender:self];
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
