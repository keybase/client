package io.keybase.android.components;

import android.graphics.Color;
import android.support.v4.view.PagerAdapter;
import android.support.v4.view.ViewPager;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.CatalystStylesDiffMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIProp;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.util.ArrayList;

public class TabBarManager extends ViewGroupManager<LinearLayout> {

    private static final String REACT_CLASS = "TabBar";
    private final ArrayList<View> tabs = new ArrayList<>();
    private final ArrayList<String> titles = new ArrayList<>();
    private final ArrayList<Boolean> selectedStates = new ArrayList<>();
    private int selectedItem;

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @UIProp(UIProp.Type.ARRAY)
    public static final String PROP_TITLES = "titles";

    @UIProp(UIProp.Type.ARRAY)
    public static final String PROP_selectedStates = "selectedStates";

    @Override
    public boolean needsCustomLayoutForChildren() {
        return false;
    }

    @Override
    public void addView(final LinearLayout parent, final View child, final int index) {
        tabs.add(child);
        //TODO Clean up this getChildAt business
        SlidingTabLayout tabBar = (SlidingTabLayout) parent.getChildAt(0);
        ViewPager viewPager = (ViewPager) parent.getChildAt(1);
        viewPager.getAdapter().notifyDataSetChanged();
        tabBar.setViewPager(viewPager);

        // Set the selected item to be the current item in case we haven't
        // Added the selected item to the view pager yet.
        if (index == selectedItem) {
            viewPager.setCurrentItem(index);
        }
    }

    @Override
    public void removeView(final LinearLayout parent, final View child) {
        tabs.remove(child);
        //TODO Clean up this getChildAt business
        SlidingTabLayout tabBar = (SlidingTabLayout) parent.getChildAt(0);
        ViewPager viewPager = (ViewPager) parent.getChildAt(1);
        viewPager.getAdapter().notifyDataSetChanged();
        tabBar.setViewPager(viewPager);
    }

    @Override
    public int getChildCount(final LinearLayout parent) {
        return tabs.size();
    }

    @Override
    public View getChildAt(final LinearLayout parent, final int index) {
        return tabs.get(index);
    }

    @Override
    protected LinearLayout createViewInstance(final ThemedReactContext themedReactContext) {
        ViewPager viewPager = new ViewPager(themedReactContext);
        viewPager.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // TODO: react native isn't playing nice when this is default of 1
        viewPager.setOffscreenPageLimit(15);
        setPagerAdapter(viewPager);

        final LinearLayout linearLayout = new LinearLayout(themedReactContext);
        linearLayout.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        linearLayout.setOrientation(LinearLayout.VERTICAL);

        SlidingTabLayout tabBar = new SlidingTabLayout(themedReactContext);
        tabBar.setViewPager(viewPager);
        linearLayout.addView(tabBar, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        viewPager.addOnPageChangeListener(new ViewPager.OnPageChangeListener() {
            @Override
            public void onPageScrolled(final int position, final float positionOffset, final int positionOffsetPixels) {
            }

            @Override
            public void onPageSelected(final int position) {
                WritableMap event = Arguments.createMap();
                event.putInt("selectedTab", position);
                themedReactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                  linearLayout.getId(),
                  "topSelect",
                  event);
            }

            @Override
            public void onPageScrollStateChanged(final int state) {

            }
        });

        linearLayout.addView(viewPager);

        return linearLayout;
    }

    public void setPagerAdapter(final ViewPager viewPager) {
        ((ViewPager) viewPager).setAdapter(new PagerAdapter() {
            final int[] colors = new int[]{Color.RED, Color.BLUE, Color.GREEN, Color.YELLOW};

            @Override
            public Object instantiateItem(ViewGroup container, int position) {
                final View child = tabs.get(position);
                container.addView(child);
                return child;
            }

            @Override
            public void destroyItem(ViewGroup container, int position, Object view) {
                container.removeView((View) view);
            }

            @Override
            public int getCount() {
                return tabs.size();
            }

            @Override
            public CharSequence getPageTitle(final int position) {
                if (position < titles.size()) {
                    return titles.get(position);
                }
                return "ERROR: index out of bounds";
            }

            @Override
            public boolean isViewFromObject(final View view, final Object object) {
                return view == ((View) object);
            }
        });
    }

    @Override
    public void updateView(final LinearLayout parent, final CatalystStylesDiffMap props) {
        ViewPager viewPager = (ViewPager) parent.getChildAt(1);

        if (props.hasKey(PROP_TITLES)) {
            titles.clear();
            final ReadableArray propTitles = props.getArray(PROP_TITLES);
            for (int i = 0; i < propTitles.size(); i++) {
                titles.add(propTitles.getString(i));
            }
        }

        if (props.hasKey(PROP_selectedStates)) {
            selectedStates.clear();
            final ReadableArray propSelectedStates = props.getArray(PROP_selectedStates);
            for (int i = 0; i < propSelectedStates.size(); i++) {
                final boolean b = propSelectedStates.getBoolean(i);
                selectedStates.add(propSelectedStates.getBoolean(i));
                if (b) {
                    // This won't work because the viewpager doesn't have this item yet
                    // viewPager.setCurrentItem(i);
                    // Instead we save the index, and set the current item when we add it.
                    selectedItem = i;
                }
            }
        }
    }
}
