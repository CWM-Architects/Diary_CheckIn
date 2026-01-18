// LineBotTest.gs - LINE Bot 測試工具

/**
 * 🧪 測試 Webhook 設定
 * 
 * 用途：檢查 LINE Webhook 是否正確設定
 * 執行：在 Apps Script 編輯器中執行此函數
 */
function testWebhookSetup() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🔍 測試 Webhook 設定');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // 檢查 Script Properties
  Logger.log('📋 步驟 1：檢查 Script Properties');
  
  const accessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const channelSecret = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_SECRET');
  
  if (!accessToken) {
    Logger.log('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定');
    Logger.log('   請到「專案設定」→「指令碼屬性」中設定');
  } else {
    Logger.log('✅ LINE_CHANNEL_ACCESS_TOKEN: ' + accessToken.substring(0, 20) + '...');
  }
  
  if (!channelSecret) {
    Logger.log('❌ LINE_CHANNEL_SECRET 未設定');
    Logger.log('   請到「專案設定」→「指令碼屬性」中設定');
  } else {
    Logger.log('✅ LINE_CHANNEL_SECRET: ' + channelSecret.substring(0, 10) + '...');
  }
  
  Logger.log('');
  
  // 檢查工作表
  Logger.log('📋 步驟 2：檢查必要工作表');
  
  const sheets = {
    'SHEET_ATTENDANCE': SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE),
    'SHEET_EMPLOYEES': SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES),
    'SHEET_LOCATIONS': SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS)
  };
  
  for (let name in sheets) {
    if (sheets[name]) {
      Logger.log(`✅ ${name} 存在`);
    } else {
      Logger.log(`❌ ${name} 不存在`);
    }
  }
  
  Logger.log('');
  
  // 檢查打卡地點
  Logger.log('📋 步驟 3：檢查打卡地點設定');
  
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
  
  if (locationSheet) {
    const lastRow = locationSheet.getLastRow();
    
    if (lastRow < 2) {
      Logger.log('⚠️ 尚未設定打卡地點');
      Logger.log('   請在「地點管理」工作表中新增地點');
    } else {
      Logger.log(`✅ 已設定 ${lastRow - 1} 個打卡地點`);
      
      const locations = locationSheet.getRange(2, 1, lastRow - 1, 5).getValues();
      
      Logger.log('');
      Logger.log('📍 地點列表:');
      locations.forEach((loc, i) => {
        const [, name, lat, lng, radius] = loc;
        Logger.log(`   ${i + 1}. ${name}`);
        Logger.log(`      座標: ${lat}, ${lng}`);
        Logger.log(`      範圍: ${radius} 公尺`);
      });
    }
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
  Logger.log('🎯 檢查完成！');
  Logger.log('');
  
  if (accessToken && channelSecret && sheets['SHEET_ATTENDANCE'] && sheets['SHEET_EMPLOYEES']) {
    Logger.log('✅✅✅ 基本設定正確，可以開始測試！');
    Logger.log('');
    Logger.log('📝 下一步：');
    Logger.log('   1. 執行 testLineBotMessage() 測試訊息處理');
    Logger.log('   2. 執行 testLineBotLocation() 測試位置打卡');
    Logger.log('   3. 用實際 LINE App 測試');
  } else {
    Logger.log('❌ 請先完成上述設定');
  }
  
  Logger.log('═══════════════════════════════════════');
}

/**
 * 🧪 測試員工註冊狀態
 * 
 * 用途：檢查 LINE User ID 是否已註冊
 * 執行：修改 testUserId 後執行
 */
function testEmployeeRegistration() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('👤 測試員工註冊狀態');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // ⚠️ 替換成你的 LINE User ID
  const testUserId = 'Ue76b65367821240ac26387d2972a5adf';
  
  Logger.log('🔍 查詢 User ID: ' + testUserId);
  Logger.log('');
  
  const employee = findEmployeeByLineUserId_(testUserId);
  
  if (employee.ok) {
    Logger.log('✅ 員工已註冊');
    Logger.log('');
    Logger.log('👤 員工資訊:');
    Logger.log('   姓名: ' + employee.name);
    Logger.log('   Email: ' + employee.email);
    Logger.log('   部門: ' + employee.dept);
    Logger.log('   狀態: ' + employee.status);
  } else {
    Logger.log('❌ 員工未註冊');
    Logger.log('');
    Logger.log('📝 解決方法:');
    Logger.log('   1. 開啟網頁版打卡系統');
    Logger.log('   2. 用 LINE 登入一次');
    Logger.log('   3. 系統會自動註冊該 LINE 帳號');
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
}

/**
 * 🧪 模擬 LINE Bot 收到「打卡」訊息
 * 
 * 用途：測試文字訊息處理流程
 * 執行：修改 testUserId 後執行
 */
function testLineBotMessage() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 測試 LINE Bot 文字訊息處理');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // ⚠️ 替換成你的 LINE User ID
  const testUserId = 'Ue76b65367821240ac26387d2972a5adf';
  
  Logger.log('📱 模擬收到訊息...');
  Logger.log('   User ID: ' + testUserId);
  Logger.log('   訊息內容: 打卡');
  Logger.log('');
  
  // 模擬 LINE Webhook 事件
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token-' + Date.now(),
            source: {
              userId: testUserId
            },
            message: {
              type: 'text',
              text: '打卡'
            }
          }
        ]
      })
    },
    parameter: {},
    headers: {}
  };
  
  try {
    const result = doPost(testEvent);
    
    Logger.log('📤 處理結果:');
    Logger.log(result.getContent());
    Logger.log('');
    Logger.log('✅ 測試完成');
    Logger.log('');
    Logger.log('📝 如果在 LINE 上沒收到訊息，檢查：');
    Logger.log('   1. User ID 是否正確');
    Logger.log('   2. 員工是否已註冊');
    Logger.log('   3. LINE Bot 的 Reply Token 是否有效');
    
  } catch (error) {
    Logger.log('❌ 測試失敗: ' + error);
    Logger.log('   錯誤堆疊: ' + error.stack);
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
}

/**
 * 🧪 模擬 LINE Bot 收到位置訊息
 * 
 * 用途：測試位置打卡流程
 * 執行：修改參數後執行
 */
function testLineBotLocation() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 測試 LINE Bot 位置打卡');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // ⚠️ 替換成你的參數
  const testUserId = 'Ue76b65367821240ac26387d2972a5adf';
  const testLat = 25.0330;      // 緯度
  const testLng = 121.5654;     // 經度
  
  Logger.log('📍 模擬傳送位置...');
  Logger.log('   User ID: ' + testUserId);
  Logger.log('   座標: ' + testLat + ', ' + testLng);
  Logger.log('');
  
  // 先檢查位置是否有效
  Logger.log('🔍 檢查位置有效性...');
  const locationCheck = checkPunchLocation(testLat, testLng);
  
  if (locationCheck.valid) {
    Logger.log('✅ 位置有效');
    Logger.log('   地點: ' + locationCheck.locationName);
    Logger.log('   距離: ' + locationCheck.distance + ' 公尺');
  } else {
    Logger.log('❌ 位置無效');
    Logger.log('   原因: ' + locationCheck.reason);
    
    if (locationCheck.nearestLocation) {
      Logger.log('   最近地點: ' + locationCheck.nearestLocation.name);
      Logger.log('   距離: ' + locationCheck.nearestLocation.distance + ' 公尺');
    }
  }
  
  Logger.log('');
  
  // 模擬位置訊息
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token-' + Date.now(),
            source: {
              userId: testUserId
            },
            message: {
              type: 'location',
              latitude: testLat,
              longitude: testLng,
              address: '測試地址'
            }
          }
        ]
      })
    },
    parameter: {},
    headers: {}
  };
  
  try {
    Logger.log('📤 執行打卡...');
    const result = doPost(testEvent);
    
    Logger.log('');
    Logger.log('📤 處理結果:');
    Logger.log(result.getContent());
    Logger.log('');
    
    // 檢查 Google Sheet 是否有新記錄
    Logger.log('🔍 檢查打卡記錄...');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
    const lastRow = sheet.getLastRow();
    const lastRecord = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];
    
    Logger.log('   最後一筆記錄:');
    Logger.log('   時間: ' + lastRecord[0]);
    Logger.log('   員工: ' + lastRecord[3]);
    Logger.log('   類型: ' + lastRecord[4]);
    Logger.log('   地點: ' + lastRecord[6]);
    
    Logger.log('');
    Logger.log('✅ 測試完成');
    
  } catch (error) {
    Logger.log('❌ 測試失敗: ' + error);
    Logger.log('   錯誤堆疊: ' + error.stack);
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
}

/**
 * 🧪 測試所有指令
 * 
 * 用途：一次測試所有 LINE Bot 指令
 * 執行：修改 testUserId 後執行
 */
function testAllCommands() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 測試所有 LINE Bot 指令');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // ⚠️ 替換成你的 LINE User ID
  const testUserId = 'Ue76b65367821240ac26387d2972a5adf';
  
  const commands = [
    '指令',
    '打卡',
    '查詢',
    '補打卡',
    '說明'
  ];
  
  commands.forEach((cmd, i) => {
    Logger.log(`📱 測試指令 ${i + 1}/${commands.length}: ${cmd}`);
    
    const testEvent = {
      postData: {
        contents: JSON.stringify({
          events: [
            {
              type: 'message',
              replyToken: 'test-reply-token-' + Date.now(),
              source: {
                userId: testUserId
              },
              message: {
                type: 'text',
                text: cmd
              }
            }
          ]
        })
      },
      parameter: {},
      headers: {}
    };
    
    try {
      doPost(testEvent);
      Logger.log('   ✅ 成功');
    } catch (error) {
      Logger.log('   ❌ 失敗: ' + error.message);
    }
    
    Logger.log('');
    
    // 等待 1 秒避免太快
    Utilities.sleep(1000);
  });
  
  Logger.log('═══════════════════════════════════════');
  Logger.log('🎉 所有測試完成！');
  Logger.log('');
  Logger.log('📝 請到 LINE 檢查是否收到訊息');
  Logger.log('═══════════════════════════════════════');
}

/**
 * 🧪 檢查今天的打卡記錄
 * 
 * 用途：查看指定員工今天的打卡狀況
 * 執行：修改 testUserId 後執行
 */
function checkTodayPunchRecords() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('📋 檢查今日打卡記錄');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // ⚠️ 替換成你的 LINE User ID
  const testUserId = 'YOUR_LINE_USER_ID_HERE';
  
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
  const values = sheet.getDataRange().getValues();
  
  Logger.log('📅 日期: ' + today);
  Logger.log('👤 User ID: ' + testUserId);
  Logger.log('');
  
  const records = [];
  
  for (let i = 1; i < values.length; i++) {
    const recordDate = Utilities.formatDate(new Date(values[i][0]), 'Asia/Taipei', 'yyyy-MM-dd');
    const recordUserId = values[i][1];
    
    if (recordUserId === testUserId && recordDate === today) {
      records.push({
        time: Utilities.formatDate(new Date(values[i][0]), 'Asia/Taipei', 'HH:mm:ss'),
        name: values[i][3],
        type: values[i][4],
        location: values[i][6],
        note: values[i][7]
      });
    }
  }
  
  if (records.length === 0) {
    Logger.log('⚠️ 今天還沒有打卡記錄');
  } else {
    Logger.log(`✅ 找到 ${records.length} 筆記錄:`);
    Logger.log('');
    
    records.forEach((r, i) => {
      Logger.log(`   ${i + 1}. ${r.type}`);
      Logger.log(`      時間: ${r.time}`);
      Logger.log(`      地點: ${r.location}`);
      Logger.log(`      備註: ${r.note || '無'}`);
      Logger.log('');
    });
    
    // 判斷打卡狀態
    const hasPunchIn = records.some(r => r.type === '上班');
    const hasPunchOut = records.some(r => r.type === '下班');
    
    Logger.log('📊 打卡狀態:');
    Logger.log('   上班卡: ' + (hasPunchIn ? '✅ 已打' : '❌ 未打'));
    Logger.log('   下班卡: ' + (hasPunchOut ? '✅ 已打' : '❌ 未打'));
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
}

/**
 * 📝 產生測試報告
 * 
 * 用途：執行所有測試並產生完整報告
 * 執行：直接執行（會花較長時間）
 */
function generateTestReport() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('📊 產生完整測試報告');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  Logger.log('⏰ 開始時間: ' + new Date());
  Logger.log('');
  
  // 測試 1: Webhook 設定
  Logger.log('========== 測試 1: Webhook 設定 ==========');
  testWebhookSetup();
  Logger.log('');
  
  // 測試 2: 員工註冊
  Logger.log('========== 測試 2: 員工註冊 ==========');
  testEmployeeRegistration();
  Logger.log('');
  
  // 測試 3: 打卡記錄
  Logger.log('========== 測試 3: 打卡記錄 ==========');
  checkTodayPunchRecords();
  Logger.log('');
  
  Logger.log('⏰ 結束時間: ' + new Date());
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
  Logger.log('🎉 報告產生完成！');
  Logger.log('═══════════════════════════════════════');
}
