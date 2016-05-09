package io.keybase.ossifrage.tests;

import android.test.ActivityInstrumentationTestCase2;
import android.widget.Toast;

import io.keybase.ossifrage.MainActivity;

public class MainActivityTest extends ActivityInstrumentationTestCase2<MainActivity> {
    private MainActivity mainActivity;

    public MainActivityTest() {
        super(MainActivity.class);
    }

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        mainActivity = getActivity();
    }

    public void testPreconditions() {
        assertNotNull("mFirstTestActivity is null", mainActivity);
    }

    public void testToastWorksLikeWeThink() {
        Toast.makeText(mainActivity, "Hello World!", Toast.LENGTH_SHORT).show();
    }
}
