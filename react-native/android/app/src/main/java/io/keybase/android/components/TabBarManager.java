package io.keybase.android.components;

import android.graphics.Color;
import android.support.v4.view.PagerAdapter;
import android.support.v4.view.ViewPager;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;

import com.facebook.react.uimanager.CatalystStylesDiffMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIProp;
import com.facebook.react.uimanager.ViewGroupManager;

import java.util.ArrayList;

public class TabBarManager extends ViewGroupManager<ViewPager> {

    private static final String REACT_CLASS = "TabBar";
    private final ArrayList<View> tabs = new ArrayList<>();

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    // We need at least 1 UIProp for react native to work :(
    @UIProp(UIProp.Type.STRING)
    public static final String PROP_PLACEHOLDERPROP = "placeholderprop";

    @Override
    public boolean needsCustomLayoutForChildren() {
        return false;
    }

    @Override
    public void addView(final ViewPager parent, final View child, final int index) {
        tabs.add(child);
        parent.getAdapter().notifyDataSetChanged();
    }

    @Override
    public void removeView(final ViewPager parent, final View child) {
        tabs.remove(child);
        parent.getAdapter().notifyDataSetChanged();
    }

    @Override
    public int getChildCount(final ViewPager parent) {
        return tabs.size();
    }

    @Override
    public View getChildAt(final ViewPager parent, final int index) {
        return tabs.get(index);
    }

    @Override
    protected ViewPager createViewInstance(final ThemedReactContext themedReactContext) {
        ViewPager viewPager = new ViewPager(themedReactContext);
        viewPager.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // TODO: react native isn't playing nice when this is default of 1
        viewPager.setOffscreenPageLimit(15);
        setPagerAdapter(viewPager);

        return viewPager;
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
                return super.getPageTitle(position);
            }

            @Override
            public boolean isViewFromObject(final View view, final Object object) {
                return view == ((View) object);
            }
        });
    }

    @Override
    public void updateView(final ViewPager viewPager, final CatalystStylesDiffMap props) {
        Log.d(REACT_CLASS, "Suppose to be updating a view");
    }
}
