//
//  KBListView.h
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBCellDataSource.h"
#import "KBScrollView.h"
#import "KBBorder.h"
#import "KBTableSelection.h"

@class KBTableView;

typedef void (^KBTableViewCellSelect)(KBTableView *tableView, KBTableSelection *selection);
typedef NSMenu *(^KBTableViewMenuSelect)(KBTableView *tableView, NSIndexPath *indexPath);
typedef void (^KBTableViewUpdate)(KBTableView *tableView);

@interface KBTableView : YOView <NSTableViewDelegate, NSTableViewDataSource>

@property (readonly) NSScrollView *scrollView;
@property (readonly) NSTableView *view;
@property (readonly) NSIndexPath *menuIndexPath;

@property (copy) KBTableViewCellSelect onSelect;
@property (copy) KBTableViewMenuSelect onMenuSelect;
@property (copy) KBTableViewUpdate onUpdate;

@property (readonly) KBCellDataSource *dataSource;

@property (nonatomic) NSInteger selectedRow;

- (void)setObjects:(NSArray *)objects;
- (void)removeAllObjects;

- (void)addObjects:(NSArray *)objects animation:(NSTableViewAnimationOptions)animation;

- (void)setObjects:(NSArray *)objects animated:(BOOL)animated;

- (NSArray *)objects;
- (NSArray *)objectsWithoutHeaders;

- (void)reloadData;

- (void)deselectAll;

- (id)selectedObject;

- (void)deselectRow;

- (void)scrollToBottom:(BOOL)animated;
- (BOOL)isAtBottom;

- (NSInteger)nextRowUp;
- (NSInteger)nextRowDown;

- (void)removeAllTableColumns;

- (NSInteger)rowCount;

- (CGFloat)contentHeight:(CGFloat)max;

@end

@interface KBTableViewHeader : NSObject
@property NSString *title;
+ (instancetype)tableViewHeaderWithTitle:(NSString *)title;
@end
