// config.js

const API_CONFIG = {
  // 正式環境的 API URL
  apiUrl: "https://script.google.com/macros/s/AKfycbynjVkSQgmEXNNe8SHnlWkeVGzyAQeA5RMJxwgsMw/dev",

  // 新增回呼網址
  redirectUrl: "https://cwm-architects.github.io/Diary_CheckIn/"
  // 你也可以在這裡加入其他設定，例如：
  // timeout: 5000,
  // version: 'v4.4.1'
};
// 👇 新增：為了兼容性，同時定義全域變數 apiUrl

const apiUrl = API_CONFIG.apiUrl;
