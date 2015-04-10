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

@class KBTableView;

typedef void (^KBCellSelect)(KBTableView *tableView, NSIndexPath *indexPath, id object);
typedef NSMenu *(^KBMenuSelect)(NSIndexPath *indexPath);
typedef void (^KBTableViewUpdate)(KBTableView *tableView);

@interface KBTableView : YOView <NSTableViewDelegate, NSTableViewDataSource>

@property (readonly) NSScrollView *scrollView;
@property (readonly) NSTableView *view;
@property KBBorder *border;
@property (readonly) NSIndexPath *menuIndexPath;

@property (copy) KBCellSelect onSelect;
@property (copy) KBMenuSelect onMenuSelect;
@property (copy) KBTableViewUpdate onUpdate;

@property (readonly) KBCellDataSource *dataSource;

@property (nonatomic) NSInteger selectedRow;

- (void)setObjects:(NSArray *)objects;
- (void)addObjects:(NSArray *)objects;
- (void)removeAllObjects;

- (void)setObjects:(NSArray *)objects animated:(BOOL)animated;

- (NSArray *)objects;
- (NSArray *)objectsWithoutHeaders;

- (void)reloadData;

- (void)deselectAll;

- (id)selectedObject;

- (void)deselectRow;

- (void)scrollToBottom:(BOOL)animated;
- (BOOL)isAtBottom;

- (void)setBorderEnabled:(BOOL)borderEnabled;
- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width;

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
