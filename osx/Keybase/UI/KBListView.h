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

typedef void (^KBCellSetBlock)(id cell, id object, NSIndexPath *indexPath, NSTableColumn *tableColumn, NSTableView *tableView, BOOL dequeued);

// Simple table view with 1 column
@interface KBListView : KBTableView

@property (copy) KBCellSetBlock cellSetBlock;
@property (readonly) Class prototypeClass;

@property (readonly) KBProgressOverlayView *progressView;

+ (instancetype)listViewWithPrototypeClass:(Class)prototypeClass rowHeight:(CGFloat)rowHeight;

@end
