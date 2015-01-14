//
//  WAYSourceListWindow.h
//  WAYSourceListWindow
//
//  Created by Raffael Hannemann on 15.11.14.
//  Copyright (c) 2014 Raffael Hannemann. All rights reserved.
//  Visit weAreYeah.com or follow @weareYeah for updates.
//
//  Licensed under the BSD License <http://www.opensource.org/licenses/bsd-license>
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
//  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
//  SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
//  TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
//  BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
//  STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
//  THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

#import "WAYSourceListWindow.h"

#define kWAYSourceListWindowDefaultMinimumMasterViewWidth 150
#define kWAYSourceListWindowDefautInitialMasterViewWidth 200
#define kWAYSourceListWindowDefaultMaximumMasterViewWidth 300
#define kWAYSourceListWindowDefaultDarkMasterViewMaterial NO
#define kWAYSourceListWindowDefaultDetailViewBackgroundColor [NSColor whiteColor]

/** This NSSplitView subclass allows to define a custom divider color. */
@interface WAYSourceListSplitView : NSSplitView
@property (strong) NSColor *customDividerColor;
@end

@implementation WAYSourceListSplitView
- (NSColor *) dividerColor {
  return _customDividerColor;
}
@end

@interface WAYSourceListWindow () <NSSplitViewDelegate>
@property (strong) NSView *customContentView;
@property (strong) NSVisualEffectView *masterViewWrapper;
@property (strong) NSView *detailViewWrapper;
@end

@implementation WAYSourceListWindow

#pragma mark - NSWindow Overwritings

- (id)initWithContentRect:(NSRect)contentRect styleMask:(NSUInteger)aStyle backing:(NSBackingStoreType)bufferingType defer:(BOOL)flag {
  if ((self = [super initWithContentRect:contentRect styleMask:aStyle backing:bufferingType defer:flag])) {
    [self setUp];
  }
  return self;
}

- (id)initWithContentRect:(NSRect)contentRect styleMask:(NSUInteger)aStyle backing:(NSBackingStoreType)bufferingType defer:(BOOL)flag screen:(NSScreen *)screen {
  if ((self = [super initWithContentRect:contentRect styleMask:aStyle backing:bufferingType defer:flag screen:screen])) {
    [self setUp];
  }
  return self;
}

- (void) awakeFromNib {

}

- (void) setInitialMasterViewWidth:(CGFloat)initialMasterViewWidth {
  _initialMasterViewWidth = initialMasterViewWidth;
  [self setMasterViewWidth: _initialMasterViewWidth];
}

- (void) setDetailViewBackgroundColor:(NSColor *)detailViewBackgroundColor {
  _detailViewBackgroundColor = detailViewBackgroundColor.copy;
  [self.detailViewWrapper.layer setBackgroundColor:_detailViewBackgroundColor.CGColor];

  // The divider color is automatically set to a darker variant of the background color
  CGFloat red = 0;
  CGFloat green = 0;
  CGFloat blue = 0;
  CGFloat factor = 0.7;
  if ([_detailViewBackgroundColor.colorSpace isEqual:[NSColorSpace genericGrayColorSpace]]) {
    red = _detailViewBackgroundColor.whiteComponent*factor;
    green = _detailViewBackgroundColor.whiteComponent*factor;
    blue = _detailViewBackgroundColor.whiteComponent*factor;
  } else {
    red = _detailViewBackgroundColor.redComponent*factor;
    green = _detailViewBackgroundColor.greenComponent*factor;
    blue = _detailViewBackgroundColor.blueComponent*factor;
  }

  NSColor *darkenedColor = [NSColor colorWithCalibratedRed:red green:green blue:blue alpha:1.0];
  [(WAYSourceListSplitView *)self.splitView setCustomDividerColor:darkenedColor];
}

- (void) setDarkMasterViewMaterial:(BOOL)darkMasterViewMaterial {
  _darkMasterViewMaterial = darkMasterViewMaterial;
  [self.masterViewWrapper setMaterial:_darkMasterViewMaterial?NSVisualEffectMaterialDark:NSVisualEffectMaterialLight];
  [self.masterViewWrapper setAppearance:[NSAppearance appearanceNamed:_darkMasterViewMaterial?NSAppearanceNameVibrantDark:NSAppearanceNameVibrantLight]];
}

- (void) setMasterView:(NSView *)view {
  [view removeFromSuperview];
  [view setFrame:self.masterViewWrapper.bounds];
  [view setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];

  if (_masterView) {
    [_masterView removeFromSuperview];
  }
  _masterView = view;
  [self.masterViewWrapper addSubview:_masterView];
}

- (void) setMasterViewWidth: (CGFloat) masterViewWidth {
  [self.splitView setPosition:masterViewWidth ofDividerAtIndex:0];
  [self setNeedsLayout];
}

- (void) setDetailView:(NSView *)view {
  [view removeFromSuperview];
  [view setFrame:self.detailViewWrapper.bounds];
  [view setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];

  if (_detailView) {
    [_detailView removeFromSuperview];
  }
  _detailView = view;
  [self.detailViewWrapper addSubview:_detailView];
}

- (void) setUp {

  [self setTitleVisibility:NSWindowTitleHidden];
  [self setTitlebarAppearsTransparent:YES];
  self.styleMask |= NSFullSizeContentViewWindowMask;

  WAYSourceListSplitView *splitView = [[WAYSourceListSplitView alloc] initWithFrame:NSMakeRect(0, 0, NSWidth(self.frame), NSHeight(self.frame))];
  [splitView setVertical:YES];
  self.splitView = splitView;

  self.masterViewWrapper = [[NSVisualEffectView alloc] initWithFrame:NSMakeRect(0, 0, kWAYSourceListWindowDefautInitialMasterViewWidth, NSHeight(self.frame))];

  [self setDarkMasterViewMaterial:kWAYSourceListWindowDefaultDarkMasterViewMaterial];
  [self.masterViewWrapper setBlendingMode:NSVisualEffectBlendingModeBehindWindow];

  self.detailViewWrapper = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, NSWidth(self.frame)-kWAYSourceListWindowDefaultMinimumMasterViewWidth, NSHeight(self.frame))];

  [self.detailViewWrapper setWantsLayer:YES];
  [self setDetailViewBackgroundColor:kWAYSourceListWindowDefaultDetailViewBackgroundColor];

  [self.splitView addSubview:self.masterViewWrapper];
  [self.splitView addSubview:self.detailViewWrapper];
  [self.splitView setDividerStyle:NSSplitViewDividerStyleThin];
  [self.splitView setDelegate:self];

  [self.splitView adjustSubviews];
  [self.splitView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];

  [self.contentView addSubview:self.splitView];

  self.minimumMasterViewWidth = kWAYSourceListWindowDefaultMinimumMasterViewWidth;
  self.maximumMasterViewWidth = kWAYSourceListWindowDefaultMaximumMasterViewWidth;
}

- (void) restoreStateWithCoder:(NSCoder *)coder {
  [super restoreStateWithCoder:coder];
  [self setNeedsLayout];
}

- (void) setContentView:(id)contentView {
  if ([contentView subviews].count>0) {
    NSLog(@"WARNING: %@ does not allow to add subviews to a %@'s instance content view in Interface Builder. Add the subview(s) to the master or detail view instead directly.", [self className], [self className]);
  }

  if (self.customContentView) return;
  self.customContentView = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 10, 10)];
  [super setContentView:self.customContentView];
}

- (void) setNeedsLayout {
  NSRect tmpRect = [self.splitView bounds];
  NSArray *subviews = [self.splitView subviews];
  NSView *collectionsSide = [subviews objectAtIndex:0];
  NSView *tableSide = [subviews objectAtIndex:1];
  float colllectionWidth = [collectionsSide bounds].size.width;

  tmpRect.size.width = tmpRect.size.width - colllectionWidth + 1;
  tmpRect.origin.x = tmpRect.origin.x + colllectionWidth + 1;
  [tableSide setFrame:tmpRect];

  tmpRect.size.width = colllectionWidth;
  tmpRect.origin.x = 0;
  [collectionsSide setFrame:tmpRect];
}

#pragma mark - NSSplitView Delegate
- (CGFloat) splitView:(NSSplitView *)splitView constrainMaxCoordinate:(CGFloat)proposedMaximumPosition ofSubviewAt:(NSInteger)dividerIndex {
  return MIN(proposedMaximumPosition, self.maximumMasterViewWidth);
}

- (CGFloat) splitView:(NSSplitView *)splitView constrainMinCoordinate:(CGFloat)proposedMinimumPosition ofSubviewAt:(NSInteger)dividerIndex {
  return MAX(proposedMinimumPosition, self.minimumMasterViewWidth);
}

- (BOOL) splitView:(NSSplitView *)splitView shouldAdjustSizeOfSubview:(NSView *)view {
  return view == self.detailViewWrapper;
}

@end