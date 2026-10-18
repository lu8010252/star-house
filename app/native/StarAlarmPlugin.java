package com.starhouse.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.AlarmClock;
import java.util.Calendar;
import com.getcapacitor.JSObject;
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
            c.getSharedPreferences("star", Context.MODE_PRIVATE).edit().putLong("setAt", at).putLong("setTime", System.currentTimeMillis()).apply();
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

    @PluginMethod
    public void getInfo(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences("star", Context.MODE_PRIVATE);
        JSObject o = new JSObject();
        o.put("setAt", String.valueOf(sp.getLong("setAt", 0)));
        o.put("ringAt", String.valueOf(sp.getLong("ringAt", 0)));
        o.put("ringSrc", sp.getString("ringSrc", ""));
        call.resolve(o);
    }

    // 交给系统时钟响铃(系统时钟不受第三方应用的后台限制):先用「计时器」,不支持再用「闹钟」(精度到分钟,向上取整)
    @PluginMethod
    public void systemTimer(PluginCall call) {
        JSObject o = new JSObject();
        Integer sec = call.getInt("seconds", 60);
        int seconds = Math.max(1, sec == null ? 60 : sec);
        String label = call.getString("label", "专注完成");
        Activity a = getActivity();
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_TIMER)
                .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                .putExtra(AlarmClock.EXTRA_MESSAGE, label)
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            a.startActivity(i);
            o.put("method", "timer"); call.resolve(o); return;
        } catch (Exception ignored) {}
        try {
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(System.currentTimeMillis() + seconds * 1000L);
            if (cal.get(Calendar.SECOND) > 0 || cal.get(Calendar.MILLISECOND) > 0) { cal.set(Calendar.SECOND, 0); cal.add(Calendar.MINUTE, 1); }
            Intent i = new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, cal.get(Calendar.HOUR_OF_DAY))
                .putExtra(AlarmClock.EXTRA_MINUTES, cal.get(Calendar.MINUTE))
                .putExtra(AlarmClock.EXTRA_MESSAGE, label)
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            a.startActivity(i);
            o.put("method", "alarm"); call.resolve(o); return;
        } catch (Exception ignored) {}
        o.put("method", "none"); call.resolve(o);
    }

    // 放弃专注时尽力取消系统计时器(部分系统时钟不支持)
    @PluginMethod
    public void cancelSystemTimer(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 26) getActivity().startActivity(new Intent(AlarmClock.ACTION_DISMISS_TIMER));
        } catch (Exception ignored) {}
        call.resolve();
    }
}
