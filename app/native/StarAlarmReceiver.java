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
import android.os.Vibrator;

public class StarAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent in) {
        final PendingResult pr = goAsync();
        String title = in.getStringExtra("title");
        String body = in.getStringExtra("body");
        if (title == null) title = "专注完成啦";
        if (body == null) body = "";

        // 1) 通知(静音渠道,声音由下面的铃声负责,这样没开通知权限时也能响)
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel("star_alarm", "专注到点提醒", NotificationManager.IMPORTANCE_HIGH);
                ch.setSound(null, null);
                ch.enableVibration(false);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
                b = new Notification.Builder(c, "star_alarm");
            } else {
                b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH);
            }
            Intent open = new Intent(c, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title).setContentText(body)
                .setCategory(Notification.CATEGORY_ALARM)
                .setContentIntent(pi).setAutoCancel(true);
            nm.notify(1001, b.build());
        } catch (Exception ignored) {}

        // 2) 响铃(闹钟音量通道)+ 震动,持续约 8 秒
        Ringtone r = null;
        try {
            Uri snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (snd == null) snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            r = RingtoneManager.getRingtone(c.getApplicationContext(), snd);
            r.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
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
            pr.finish();
        }, 8000);
    }
}
