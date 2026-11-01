// Text for the notification prompt in the seven languages Hibira ships.
// {site} is replaced with the site name (options.siteName, or the page's host).

export const MESSAGES = {
  en: {
    title: 'Turn on desktop notifications',
    body: 'Get notified about new activity from {site}, even when this tab is in the background.',
    allow: 'Turn on',
    later: 'Not now',
    close: 'Close',
    pending: 'Choose "Allow" in the box your browser shows.',
    granted: 'Notifications are on.',
    blocked: 'Notifications are blocked for this site. To turn them on, click the icon next to the address bar and allow notifications.',
    error: 'Notifications could not be turned on right now. Please try again later.',
  },
  'zh-TW': {
    title: '開啟桌面通知',
    body: '開啟後，即使這個分頁在背景，{site} 有新動態時也會通知您。',
    allow: '開啟',
    later: '稍後再說',
    close: '關閉',
    pending: '請在瀏覽器跳出的視窗中選擇「允許」。',
    granted: '已開啟通知。',
    blocked: '此網站的通知已被封鎖。如要開啟，請點選網址列旁的圖示，將通知設為「允許」。',
    error: '目前無法開啟通知，請稍後再試。',
  },
  'zh-CN': {
    title: '开启桌面通知',
    body: '开启后，即使此标签页在后台，{site} 有新动态时也会通知您。',
    allow: '开启',
    later: '以后再说',
    close: '关闭',
    pending: '请在浏览器弹出的窗口中选择“允许”。',
    granted: '已开启通知。',
    blocked: '此网站的通知已被屏蔽。如需开启，请点击地址栏旁的图标，将通知设为“允许”。',
    error: '暂时无法开启通知，请稍后再试。',
  },
  ja: {
    title: 'デスクトップ通知をオンにする',
    body: 'オンにすると、このタブがバックグラウンドにあっても {site} の新しいお知らせを受け取れます。',
    allow: 'オンにする',
    later: '後で',
    close: '閉じる',
    pending: 'ブラウザに表示される画面で「許可」を選んでください。',
    granted: '通知をオンにしました。',
    blocked: 'このサイトの通知はブロックされています。オンにするには、アドレスバー横のアイコンをクリックして通知を「許可」にしてください。',
    error: '通知をオンにできませんでした。しばらくしてからもう一度お試しください。',
  },
  ko: {
    title: '데스크톱 알림 켜기',
    body: '알림을 켜면 이 탭이 백그라운드에 있어도 {site}의 새 소식을 받을 수 있습니다.',
    allow: '켜기',
    later: '나중에',
    close: '닫기',
    pending: "브라우저에 표시되는 창에서 '허용'을 선택하세요.",
    granted: '알림이 켜졌습니다.',
    blocked: "이 사이트의 알림이 차단되어 있습니다. 알림을 켜려면 주소창 옆 아이콘을 클릭하고 알림을 '허용'으로 바꾸세요.",
    error: '지금은 알림을 켤 수 없습니다. 잠시 후 다시 시도하세요.',
  },
  th: {
    title: 'เปิดการแจ้งเตือนบนเดสก์ท็อป',
    body: 'เปิดไว้แล้วคุณจะได้รับการแจ้งเตือนเมื่อ {site} มีความเคลื่อนไหวใหม่ แม้แท็บนี้จะอยู่เบื้องหลัง',
    allow: 'เปิด',
    later: 'ไว้ทีหลัง',
    close: 'ปิด',
    pending: 'โปรดเลือก "อนุญาต" ในหน้าต่างที่เบราว์เซอร์แสดง',
    granted: 'เปิดการแจ้งเตือนแล้ว',
    blocked: 'การแจ้งเตือนของเว็บไซต์นี้ถูกบล็อกอยู่ หากต้องการเปิด ให้คลิกไอคอนข้างแถบที่อยู่แล้วตั้งค่าการแจ้งเตือนเป็น "อนุญาต"',
    error: 'ยังเปิดการแจ้งเตือนไม่ได้ในขณะนี้ โปรดลองอีกครั้งภายหลัง',
  },
  vi: {
    title: 'Bật thông báo trên máy tính',
    body: 'Bật để nhận thông báo khi {site} có hoạt động mới, ngay cả khi tab này đang chạy nền.',
    allow: 'Bật',
    later: 'Để sau',
    close: 'Đóng',
    pending: 'Hãy chọn "Cho phép" trong hộp thoại trình duyệt hiển thị.',
    granted: 'Đã bật thông báo.',
    blocked: 'Thông báo của trang này đang bị chặn. Để bật, hãy nhấp vào biểu tượng cạnh thanh địa chỉ và đặt thông báo thành "Cho phép".',
    error: 'Hiện chưa thể bật thông báo. Vui lòng thử lại sau.',
  },
};

export const LOCALES = Object.keys(MESSAGES);

// pickLocale returns the first supported locale from the given language tags
// (for example navigator.languages), falling back to English. Chinese tags
// without a script or region pick by script/region: zh-Hant, zh-HK and zh-MO
// read Traditional; other zh tags read Simplified.
export function pickLocale(tags) {
  for (const raw of [].concat(tags || [])) {
    if (typeof raw !== 'string' || !raw) continue;
    const tag = raw.replace('_', '-');
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) {
      return /^zh-(hant|tw|hk|mo)/.test(lower) ? 'zh-TW' : 'zh-CN';
    }
    const base = lower.split('-')[0];
    if (MESSAGES[base]) return base;
  }
  return 'en';
}

// messagesFor merges the locale's text with the site's overrides and fills
// in {site}.
export function messagesFor(locale, overrides, site) {
  const base = MESSAGES[locale] || MESSAGES.en;
  const out = {};
  for (const key of Object.keys(MESSAGES.en)) {
    const v = overrides && typeof overrides[key] === 'string' ? overrides[key] : base[key];
    out[key] = v.split('{site}').join(site);
  }
  return out;
}
