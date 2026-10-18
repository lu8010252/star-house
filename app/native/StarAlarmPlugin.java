package com.starhouse.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 闹钟式提醒:AlarmManager.setAlarmClock(与系统时钟闹铃同机制,不受 Doze/省电限制,无需额外权限)
@CapacitorPlugin(name = "StarAlarm")
public class StarAlarmPlugin extends Plugin {
    private static PendingIntent alarmIntent(Context c, String title, String body) {
        Intent i = new Intent(c, StarAlarmReceiver.class);
        i.putExtra("title", title);
        i.putExtra("body", body);
        return PendingIntent.getBroadcast(c, 1001, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            String s = call.getString("at");
            if (s == null) { call.reject("缺少时间"); return; }
            long at = Long.parseLong(s);
            String title = call.getString("title", "专注完成啦");
            String body = call.getString("body", "");
            Context c = getContext();
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            Intent open = new Intent(c, MainActivity.class);
            PendingIntent showPi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), alarmIntent(c, title, body));
            try {
                Intent svc = new Intent(c, StarFocusService.class);
                svc.putExtra("at", at); svc.putExtra("title", title); svc.putExtra("body", body);
                ContextCompat.startForegroundService(c, svc);
            } catch (Exception ignored) {}
            call.resolve();
        } catch (Exception e) {
            call.reject("设置闹钟失败:" + e.getMessage());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            Context c = getContext();
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            am.cancel(alarmIntent(c, "", ""));
            c.stopService(new Intent(c, StarFocusService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
