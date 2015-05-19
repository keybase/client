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
#import "KBInfoView.h"
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
  _listView.onSelect = ^(KBTableView *tableView, NSIndexPath *indexPath, id<KBComponent> component) {
    [gself select:component];
  };
  _listView.onMenuSelect = ^NSMenu *(KBTableView *tableView, NSIndexPath *indexPath) {
    id<KBComponent> component = [tableView.dataSource objectAtIndexPath:indexPath];
    if (![component conformsToProtocol:@protocol(KBInstallable)]) return nil;

    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Uninstall" action:@selector(uninstall:) keyEquivalent:@""];
    return menu;
  };
  [_splitView setLeftView:_listView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_splitView top:@[] bottom:@[] insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20];
}

- (void)select:(id<KBComponent>)component {
  [_splitView setRightView:nil];
  GHWeakSelf gself = self;
  [self viewForComponent:component completion:^(NSView *view) {
    if (view && ![view isKindOfClass:KBScrollView.class]) {
      KBScrollView *scrollView = [KBScrollView scrollViewWithDocumentView:view];
      [gself.splitView setRightView:scrollView];
    } else {
      [gself.splitView setRightView:view];
    }
  }];
}

+ (instancetype)openWithComponents:(NSArray */*of id<KBComponent>*/)components sender:(id)sender {
  KBControlPanel *view = [[KBControlPanel alloc] init];
  [view addComponents:components];
  [[sender window] kb_addChildWindowForView:view rect:CGRectMake(0, 40, 800, 400) position:KBWindowPositionRight title:@"Control Panel" fixed:NO makeKey:NO];
  return view;
}

- (void)addComponents:(NSArray */*of id<KBComponent>*/)components {
  [_listView addObjects:components animation:NSTableViewAnimationEffectNone];
  if (!_listView.selectedObject) _listView.selectedRow = 0;
}

- (void)viewForComponent:(id<KBComponent>)component completion:(void (^)(NSView *view))completion {
  _selectedComponent = component;
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  [component refresh:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (gself.selectedComponent == component) {
      completion([component contentView]);
    }
  }];
}

- (void)uninstall:(id)sender {
  NSIndexPath *indexPathToUninstall = _listView.menuIndexPath;
  if (!indexPathToUninstall) return;

  id<KBInstallable> component = [_listView.dataSource objectAtIndexPath:indexPathToUninstall];
  if (!component) return;

  [KBActivity setProgressEnabled:YES sender:self];
  [component uninstall:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
  }];

}

@end
