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

@interface KBControlPanel ()
@property KBListView *listView;
@property KBSplitView *splitView;

@property id<KBComponent> selectedComponent;
@end

@implementation KBControlPanel

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _splitView = [[KBSplitView alloc] init];
  _splitView.dividerPosition = 260;
  _splitView.divider.hidden = YES;
  _splitView.rightInsets = UIEdgeInsetsMake(0, 20, 0, 0);
  [self addSubview:_splitView];

  GHWeakSelf gself = self;
  _listView = [KBListView listViewWithPrototypeClass:KBImageTextCell.class rowHeight:0];
  _listView.scrollView.borderType = NSBezelBorder;
  _listView.cellSetBlock = ^(KBImageTextView *label, id<KBComponent> component, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued) {
    [label setTitle:component.name info:component.info image:component.image];
  };
  _listView.onSelect = ^(KBTableView *tableView, KBTableSelection *selection) {
    [gself select:selection.object];
  };
  _listView.onMenuSelect = ^NSMenu *(KBTableView *tableView, NSIndexPath *indexPath) {
    id<KBComponent> component = [tableView.dataSource objectAtIndexPath:indexPath];
    if (![component conformsToProtocol:@protocol(KBInstallable)]) return nil;

    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Uninstall" action:@selector(uninstallSelected:) keyEquivalent:@""];
    return menu;
  };
  [_splitView setLeftView:_listView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_splitView top:@[] bottom:@[] insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20];
}

- (void)select:(id<KBComponent>)component {
  [_splitView setRightView:nil];
  GHWeakSelf gself = self;
  [self viewForComponent:component completion:^(NSView *view) {
    [view removeFromSuperview];
    [gself setContentView:view component:component];
  }];
}

- (void)setContentView:(NSView *)contentView component:(id<KBComponent>)component {
  YOView *view = [YOView view];
  [view addSubview:contentView];

  YOBorderLayout *borderLayout = [YOBorderLayout layout];
  borderLayout.spacing = 10;
  view.viewLayout = borderLayout;
  [borderLayout setCenter:contentView];

  if ([component conformsToProtocol:@protocol(KBInstallable)]) {
    YOHBox *topView = [YOHBox box:@{@"spacing": @(10)}];
    id<KBInstallable> installable = (id<KBInstallable>)component;
    [topView addSubview:[KBButton buttonWithText:@"Refresh" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self refresh]; }]];

    if ([installable.componentStatus needsInstallOrUpgrade]) {
      [topView addSubview:[KBButton buttonWithText:installable.componentStatus.actionLabel style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self install:installable]; }]];
    } else if (installable.componentStatus.installStatus == KBInstallStatusInstalled) {
      [topView addSubview:[KBButton buttonWithText:@"Uninstall" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self uninstall:installable]; }]];
    }

    if (installable.componentStatus.runtimeStatus == KBRuntimeStatusNotRunning) {
      [topView addSubview:[KBButton buttonWithText:@"Start" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self start:installable]; }]];
    } else if (installable.componentStatus.runtimeStatus == KBRuntimeStatusRunning) {
      [topView addSubview:[KBButton buttonWithText:@"Stop" style:KBButtonStyleDefault options:KBButtonOptionsToolbar targetBlock:^{ [self stop:installable]; }]];
    }

    [view addSubview:topView];
    [borderLayout addToTop:topView];
  }

  [_splitView setRightView:view];
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
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  [component refreshComponent:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (gself.selectedComponent == component) {
      completion([component componentView]);
    }
  }];
}

- (void)refresh {
  if (!_selectedComponent) return;
  [KBActivity setProgressEnabled:YES sender:self];
  GHWeakSelf gself = self;
  [_selectedComponent refreshComponent:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    [self select:gself.selectedComponent];
  }];
}

- (void)install:(id<KBInstallable>)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable install:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];
}

- (void)start:(id<KBInstallable>)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable start:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];
}

- (void)stop:(id<KBInstallable>)installable {
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
  id<KBInstallable> component = [_listView.dataSource objectAtIndexPath:indexPathToUninstall];
  if (!component) return;
  [self uninstall:component];
}

- (void)uninstall:(id<KBInstallable>)installable {
  [KBActivity setProgressEnabled:YES sender:self];
  [installable uninstall:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    [self refresh];
  }];

}

@end
