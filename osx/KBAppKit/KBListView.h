//
//  KBListView.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBTableView.h"

#import "KBProgressOverlayView.h"

@class KBListView;

typedef NSString *(^KBListViewCellIdentifier)(NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView);
typedef id (^KBListViewCellCreate)(NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView);
typedef void (^KBListViewCellSet)(id cell, id object, NSIndexPath *indexPath, NSTableColumn *tableColumn, KBListView *listView, BOOL dequeued);

// Simple table view with 1 column
@interface KBListView : KBTableView

@property (copy) KBListViewCellIdentifier onIdentifier;
@property (copy) KBListViewCellCreate onCreate;
@property (copy) KBListViewCellSet onSet;

@property (readonly) KBProgressOverlayView *progressView;

+ (instancetype)listViewWithRowHeight:(CGFloat)rowHeight;
+ (instancetype)listViewWithPrototypeClass:(Class)prototypeClass rowHeight:(CGFloat)rowHeight;

@end


@interface KBCellView : NSView
@property (nonatomic) id view;
@end