//
//  KBControlPanel.m
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBControlPanel.h"

#import "KBButtonView.h"
#import "KBEnvironment.h"
#import "KBHeaderLabelView.h"
#import "KBDebugPropertiesView.h"
#import "KBInstallable.h"

#import <MDPSplitView/MDPSplitView.h>
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBControlPanel ()
@property KBListView *listView;
@property MDPSplitView *splitView;
@property YOView *rightView;

@property id<KBComponent> selectedComponent;
@end

@implementation KBControlPanel

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _splitView = [[MDPSplitView alloc] init];
  _splitView.vertical = YES;
  //_splitView.divider.hidden = YES;
  [self addSubview:_splitView];

  GHWeakSelf gself = self;
  _listView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:0];
  _listView.scrollView.borderType = NSBezelBorder;
  _listView.onSet = ^(KBImageTextView *label, id<KBComponent> component, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:component.name info:component.info image:component.image lineBreakMode:NSLineBreakByClipping];
  };
  _listView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    [gself select:selection.object];
  };
  _listView.onMenuSelect = ^NSMenu *(KBTableView *tableView, NSIndexPath *indexPath) {
    //id<KBComponent> component = [tableView.dataSource objectAtIndexPath:indexPath];
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    //[menu addItemWithTitle:@"Uninstall" action:@selector(uninstallSelected:) keyEquivalent:@""];
    return menu;
  };
  [_splitView addSubview:_listView];

  _rightView = [YOView view];
  [_splitView addSubview:_rightView];

  [_splitView adjustSubviews];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_splitView top:@[] bottom:@[] insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20];
}

- (void)viewDidMoveToSuperview {
  [super viewDidMoveToSuperview];
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.splitView setPosition:240 ofDividerAtIndex:0 animated:NO];
  });
}

- (void)select:(id<KBComponent>)component {
  GHWeakSelf gself = self;
  [self viewForComponent:component completion:^(NSView *view) {
    [view removeFromSuperview];
    [gself setContentView:view component:component];
  }];
}

- (void)setContentView:(NSView *)contentView component:(id<KBComponent>)component {
  YOView *view = [YOView view];
  [view addSubview:contentView];

  YOVBorderLayout *borderLayout = [YOVBorderLayout layout];
  borderLayout.spacing = 10;
  view.viewLayout = borderLayout;
  [borderLayout setCenter:contentView];

  if ([component isKindOfClass:KBInstallable.class]) {
    YOHBox *topView = [YOHBox box:@{@"spacing": @(10)}];
    KBInstallable *installable = (KBInstallable *)component;
    [topView addSubview:[KBButton buttonWithText:@"Refresh" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self refresh]; }]];

    if ([installable.componentStatus needsInstallOrUpgrade]) {
      [topView addSubview:[KBButton buttonWithText:NSStringFromKBRInstallAction(installable.componentStatus.installAction) style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self install:installable]; }]];
    } else {
      [topView addSubview:[KBButton buttonWithText:@"Re-Install" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self install:installable]; }]];
    }

    if (installable.componentStatus.installStatus == KBRInstallStatusInstalled) {
      [topView addSubview:[KBButton buttonWithText:@"Uninstall" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self uninstall:installable]; }]];

      switch ([installable runtimeStatus]) {
        case KBInstallRuntimeStatusStopped: {
          [topView addSubview:[KBButton buttonWithText:@"Start" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self start:installable]; }]];
          break;
        }
        case KBInstallRuntimeStatusStarted: {
          [topView addSubview:[KBButton buttonWithText:@"Stop" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self stop:installable]; }]];
          break;
        }
        case KBInstallRuntimeStatusNone: break;
      }
    }

    [view addSubview:topView];
    [borderLayout addToTop:topView];
  }

  for (NSView *view in _rightView.subviews) [view removeFromSuperview];
  [_rightView addSubview:view];
  _rightView.viewLayout = [YOLayout fill:view];
}

- (void)open:(id)sender {
  [[sender window] kb_addChildWindowForView:self rect:CGRectMake(0, 40, 800, 500) position:KBWindowPositionRight title:@"Control Panel" fixed:NO makeKey:NO];
}

- (void)addComponents:(NSArray */*of id<KBComponent>*/)components {
  [_listView addObjects:components animation:NSTableViewAnimationEffectNone];
  if (!_listView.selectedObject) _listView.selectedRow = 0;
}

- (void)viewForComponent:(id<KBComponent>)component completion:(void (^)(NSView *view))completion {
  _selectedComponent = component;
  completion([_selectedComponent componentView]);
  /*
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  [component refreshComponent:^(NSError *error) {
    if (error) [KBActivity setError:error sender:self];
    [KBActivity setProgressEnabled:NO sender:self];
      completion([gself.selectedComponent componentView]);
  }];
   */
}

- (void)refresh {
  if (!_selectedComponent) return;
  [KBActivity setProgressEnabled:YES sender:self];
  GHWeakSelf gself = self;
  [_selectedComponent refreshComponent:^(KBComponentStatus *cs) {
    [KBActivity setProgressEnabled:NO sender:self];
    [self select:gself.selectedComponent];
  }];
}

- (void)install:(KBInstallable *)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable install:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];
}

- (void)start:(KBInstallable *)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable start:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];
}

- (void)stop:(KBInstallable *)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable stop:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];
}

- (void)uninstallSelected:(id)sender {
  NSIndexPath *indexPathToUninstall = _listView.menuIndexPath;
  if (!indexPathToUninstall) return;
  KBInstallable *component = [_listView.dataSource objectAtIndexPath:indexPathToUninstall];
  if (!component) return;
  [self uninstall:component];
}

- (void)uninstall:(KBInstallable *)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable uninstall:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];

}

@end
