package com.starhouse.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

// 专注期间的前台服务:保活进程(防止黑屏几分钟后被系统杀掉),到点自己也响铃(与闹钟互为保险)
public class StarFocusService extends Service {
    private final Handler h = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wl;

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent in, int flags, int startId) {
        final long at = in != null ? in.getLongExtra("at", 0) : 0;
        final String title = in != null ? in.getStringExtra("title") : null;
        final String body = in != null ? in.getStringExtra("body") : null;
        long left = Math.max(0, at - System.currentTimeMillis());

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel("star_focus", "专注进行中", NotificationManager.IMPORTANCE_LOW);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
            b = new Notification.Builder(this, "star_focus");
        } else {
            b = new Notification.Builder(this);
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("专注中,加油!")
            .setContentText("倒计时结束会响铃提醒")
            .setOngoing(true).setShowWhen(true).setWhen(at)
            .setUsesChronometer(true).setChronometerCountDown(true)
            .setContentIntent(pi);
        Notification n = b.build();
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(1002, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(1002, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            if (wl != null && wl.isHeld()) wl.release();
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "starhouse:focus");
            wl.acquire(left + 60000);
        } catch (Exception ignored) {}

        h.removeCallbacksAndMessages(null);
        h.postDelayed(() -> {
            StarAlarmReceiver.ring(getApplicationContext(), title, body, null, "服务");
            h.postDelayed(this::stopSelf, 9000);
        }, left);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        h.removeCallbacksAndMessages(null);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) {}
        super.onDestroy();
    }
}
