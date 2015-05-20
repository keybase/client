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

  KBListView *listView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:0];
  listView.scrollView.borderType = NSBezelBorder;
  listView.cellSetBlock = ^(KBImageTextView *label, KBEnvironment *env, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:env.title info:env.info image:env.image];
  };
  listView.onSelect = ^(KBTableView *tableView, NSIndexPath *indexPath, KBEnvironment *environment) {
    [self select:environment];
  };
  [_splitView setLeftView:listView];

  GHWeakSelf gself = self;
  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [self addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Next" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{
    KBEnvironment *env = listView.selectedObject;
    if ([env.identifier isEqualToString:@"custom"]) {
      KBEnvironment *environment = [gself.customView environment];
      [gself.customView saveToDefaults];
      NSError *error = nil;
      if (![environment validate:&error]) {
        [KBActivity setError:error sender:self];
        return;
      }
      self.onSelect(environment);
    } else {
      self.onSelect(env);
    }
  };
  [buttons addSubview:nextButton];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_splitView top:@[header] bottom:@[buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];

  _customView = [[KBCustomEnvView alloc] init];
  KBEnvironment *customEnvironment = [_customView loadFromDefaults];

  [listView setObjects:@[[KBEnvironment env:KBEnvKeybaseIO], [KBEnvironment env:KBEnvLocalhost], customEnvironment] animated:NO];
  [listView setSelectedRow:2];
}

- (void)select:(KBEnvironment *)environment {
  [_splitView setRightView:[self viewForEnvironment:environment]];
}

- (NSView *)viewForEnvironment:(KBEnvironment *)environment {
  if ([environment.identifier isEqual:@"custom"]) {
    [_customView setEnvironment:environment];
    return _customView;
  }

  YOVBox *view = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];

  typedef NSView * (^KBCreateEnvInfoLabel)(NSString *key, NSString *value);

  KBCreateEnvInfoLabel createView = ^NSView *(NSString *key, NSString *value) {
    KBHeaderLabelView *view = [KBHeaderLabelView headerLabelViewWithHeader:key headerOptions:0 text:value style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByCharWrapping];
    view.columnWidth = 120;
    return view;
  };

  [view addSubview:createView(@"Id", environment.identifier)];
  [view addSubview:createView(@"Home", KBPath(environment.homeDir, YES))];
  if (environment.host) [view addSubview:createView(@"Host", environment.host)];
  if (environment.mountDir) [view addSubview:createView(@"Mount", KBPath(environment.mountDir, YES))];
  if (environment.isLaunchdEnabled) {
    [view addSubview:createView(@"Service ID", environment.launchdLabelService)];
    [view addSubview:createView(@"KBFS ID", environment.launchdLabelKBFS)];
  }

  if (!environment.isInstallEnabled) {
    [view addSubview:createView(@"Other", @"Installer Disabled")];
  }

  //[view addSubview:createView(@"Service", [environment commandLineForService:YES])];
  //[view addSubview:createView(@"KBFS", [environment commandLineForKBFS:YES])];

  [view kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  return view;
}

@end
