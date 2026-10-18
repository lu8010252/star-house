package com.starhouse.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StarAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
