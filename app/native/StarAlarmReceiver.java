package com.starhouse.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;

public class StarAlarmReceiver extends BroadcastReceiver {
    private static long lastRing = 0;

    @Override
    public void onReceive(Context c, Intent in) {
        ring(c, in.getStringExtra("title"), in.getStringExtra("body"), goAsync(), "闹钟");
    }

    // 点亮屏幕 + 带闹钟铃声的通知(系统播放) + 应用内铃声 + 震动;闹钟广播和前台服务都会调用,15 秒内只响一次
    static synchronized void ring(Context c, String title, String body, final PendingResult pr, String src) {
        long now = System.currentTimeMillis();
        if (now - lastRing < 15000) { if (pr != null) pr.finish(); return; }
        lastRing = now;
        try { c.getSharedPreferences("star", Context.MODE_PRIVATE).edit().putLong("ringAt", now).putString("ringSrc", src).apply(); } catch (Exception ignored) {}
        if (title == null) title = "专注完成啦";
        if (body == null) body = "";

        Uri snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (snd == null) snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        final AudioAttributes aa = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();

        // 0) 点亮屏幕(像真正的闹钟一样),很多系统在息屏时会把响铃推迟到亮屏
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock sw = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "starhouse:ring");
            sw.acquire(10000);
        } catch (Exception ignored) {}

        // 1) 通知:渠道自带闹钟铃声+震动,由系统播放
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel("star_alarm2", "专注到点提醒", NotificationManager.IMPORTANCE_HIGH);
                ch.setSound(snd, aa);
                ch.enableVibration(true);
                ch.setVibrationPattern(new long[]{0, 500, 250, 500, 250, 500});
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
                b = new Notification.Builder(c, "star_alarm2");
            } else {
                b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH).setSound(snd);
            }
            Intent open = new Intent(c, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title).setContentText(body)
                .setCategory(Notification.CATEGORY_ALARM)
                .setContentIntent(pi).setFullScreenIntent(pi, true).setAutoCancel(true);
            nm.notify(1001, b.build());
        } catch (Exception ignored) {}

        // 2) 应用内铃声 + 震动(与通知互为保险),持续约 8 秒
        Ringtone r = null;
        try {
            r = RingtoneManager.getRingtone(c.getApplicationContext(), snd);
            r.setAudioAttributes(aa);
            if (Build.VERSION.SDK_INT >= 28) r.setLooping(true);
            r.play();
        } catch (Exception ignored) {}
        try {
            Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(new long[]{0, 500, 250, 500, 250, 500}, -1);
        } catch (Exception ignored) {}

        final Ringtone rr = r;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try { if (rr != null) rr.stop(); } catch (Exception ignored) {}
            if (pr != null) pr.finish();
        }, 8000);
    }
}
