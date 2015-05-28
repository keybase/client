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
  _listView.cellSetBlock = ^(KBImageTextView *label, KBEnvironment *env, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:env.config.title info:env.config.info image:env.config.image];
  };
  _listView.onSelect = ^(KBTableView *tableView, NSIndexPath *indexPath, KBEnvironment *environment) {
    [gself select:environment];
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

  self.viewLayout = [YOBorderLayout layoutWithCenter:_splitView top:@[header] bottom:@[buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];

  _customView = [[KBCustomEnvView alloc] init];
  KBEnvConfig *custom = [_customView loadFromDefaults];

  [_listView setObjects:@[
                          [[KBEnvironment alloc] initWithConfig:[KBEnvConfig env:KBEnvKeybaseIO]],
                          [[KBEnvironment alloc] initWithConfig:[KBEnvConfig env:KBEnvLocalhost]],
                          [[KBEnvironment alloc] initWithConfig:[KBEnvConfig env:KBEnvLocalhost2]],
                          [[KBEnvironment alloc] initWithConfig:custom],
                         ] animated:NO];
  [_listView setSelectedRow:[_listView.dataSource countForSection:0] - 1];
}

- (void)select:(KBEnvironment *)environment {
  [_splitView setRightView:[self viewForEnvironment:environment]];
}

- (void)next {
  KBEnvironment *env = _listView.selectedObject;
  if ([env.config.identifier isEqualToString:@"custom"]) {
    KBEnvConfig *config = [_customView config];
    [_customView saveToDefaults];
    NSError *error = nil;
    if (![config validate:&error]) {
      [KBActivity setError:error sender:self];
      return;
    }
    self.onSelect([[KBEnvironment alloc] initWithConfig:config]);
  } else {
    self.onSelect(env);
  }
}

- (void)clearEnv {
  KBEnvironment *env = _listView.selectedObject;
  [KBAlert yesNoWithTitle:@"Clear Environment" description:NSStringWithFormat(@"Are you sure you want to clear %@?", env.config.title) yes:@"Clear" view:self completion:^(BOOL yes) {
    [env uninstallServices:^(NSError *error) {
      if (error) DDLogError(@"Error: %@", error);
    }];
  }];
}

- (NSView *)viewForEnvironment:(KBEnvironment *)environment {
  if ([environment.config.identifier isEqual:@"custom"]) {
    [_customView setConfig:environment.config];
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

  KBEnvConfig *config = environment.config;
  [labels addSubview:createView(@"Id", config.identifier)];
  [labels addSubview:createView(@"Home", KBPath(config.homeDir, YES))];
  if (config.host) [labels addSubview:createView(@"Host", config.host)];
  if (config.mountDir) [labels addSubview:createView(@"Mount", KBPath(config.mountDir, YES))];
  if (config.isLaunchdEnabled) {
    [labels addSubview:createView(@"Service ID", config.launchdLabelService)];
    [labels addSubview:createView(@"KBFS ID", config.launchdLabelKBFS)];
  }

  if (!config.isInstallEnabled) {
    [labels addSubview:createView(@"Other", @"Installer Disabled")];
  }

  //[view addSubview:createView(@"Service", [environment commandLineForService:YES])];
  //[view addSubview:createView(@"KBFS", [environment commandLineForKBFS:YES])];

  GHWeakSelf gself = self;
  YOHBox *buttons = [YOHBox box];
  [view addSubview:buttons];
  [buttons addSubview:[KBButton buttonWithText:@"Clear" style:KBButtonStyleToolbar targetBlock:^{ [gself clearEnv]; }]];

  return view;
}

@end
