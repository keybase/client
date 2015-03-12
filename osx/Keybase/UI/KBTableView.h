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

typedef void (^KBCellSelectBlock)(KBTableView *tableView, NSIndexPath *indexPath, id object);

@interface KBTableView : YONSView <NSTableViewDelegate, NSTableViewDataSource>

@property (readonly) KBScrollView *scrollView;
@property (readonly) NSTableView *view;
@property KBBorder *border;

@property (copy) KBCellSelectBlock selectBlock;

@property (readonly) KBCellDataSource *dataSource;

- (void)setObjects:(NSArray *)objects;
- (void)addObjects:(NSArray *)objects;
- (void)removeAllObjects;

- (void)setObjects:(NSArray *)objects animated:(BOOL)animated;

- (void)deselectAll;

- (id)selectedObject;

// Subclasses can implement
- (void)selectItem:(id)item;

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width borderType:(KBBorderType)borderType;

@end
