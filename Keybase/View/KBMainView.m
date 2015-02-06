//
//  KBMainView.m
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBMainView.h"

#import "KBSourceView.h"

@interface KBMainView ()
@property KBSourceView *sourceView;
@property KBBox *border;
@property NSView *contentView;
@end

@implementation KBMainView

- (void)viewInit {
  [super viewInit];

  _sourceView = [[KBSourceView alloc] init];
  [self addSubview:_sourceView];

  _border = [KBBox lineWithWidth:1.0 color:[KBLookAndFeel lineColor]];
  [self addSubview:_border];

  _contentView = [[NSView alloc] init];
  _contentView.wantsLayer = YES;
  [_contentView.layer setBackgroundColor:[NSColor colorWithCalibratedWhite:0.96 alpha:1.0].CGColor];
  [self addSubview:_contentView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 150;
    [layout setFrame:CGRectMake(0, 0, col1 - 1, size.height) view:yself.sourceView];
    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:yself.border];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.contentView];
    return size;
  }];
}

- (NSWindow *)createWindow {
  NSWindow *window = [KBWindow windowWithContentView:self size:CGSizeMake(600, 400) retain:YES];
  window.minSize = CGSizeMake(300, 300);
  //window.restorable = YES;
  window.delegate = self;
  //window.maxSize = CGSizeMake(600, 900);
  window.titleVisibility = NO;
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSMiniaturizableWindowMask;
  //window.restorationClass = self.class;
  //window.navigation.titleView = [KBTitleView titleViewWithTitle:@"Keybase" navigation:window.navigation];
  //[window setLevel:NSStatusWindowLevel];
  return window;
}

//- (void)window:(NSWindow *)window willEncodeRestorableState:(NSCoder *)state {
//  [state encodeObject:[NSValue valueWithRect:window.frame] forKey:@"frame"];
//}
//
//- (void)window:(NSWindow *)window didDecodeRestorableState:(NSCoder *)state {}
//
//+ (void)restoreWindowWithIdentifier:(NSString *)identifier state:(NSCoder *)state completionHandler:(void (^)(NSWindow *window, NSError *error))completionHandler {
//  NSRect rect = [[state decodeObjectForKey:@"frame"] rectValue];
//
//  KBMainView *mainView = [[KBMainView alloc] init];
//  NSWindow *window = [mainView createWindow];
//  if (rect.size.width > 0) [window setFrame:rect display:YES];
//
//  completionHandler(window, nil);
//}

@end
