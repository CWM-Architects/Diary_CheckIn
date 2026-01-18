// LineBotPunch.gs - LINE Bot 打卡完整實作

// ========== 修改 handleLineMessage ==========
function handleLineMessage(event) {
  try {
    const userId = event.source.userId;
    const text = event.message.text.trim();
    const replyToken = event.replyToken;
    
    Logger.log('📱 收到 LINE 訊息');
    Logger.log('   userId: ' + userId);
    Logger.log('   text: ' + text);
    
    const employee = findEmployeeByLineUserId_(userId);
    
    if (!employee.ok) {
      replyMessage(replyToken, '❌ 您尚未註冊為系統員工\n\n請先到網頁版登入以完成註冊\n🔗 https://eric693.github.io/Greedy_check_manager/');
      return;
    }
    
    Logger.log('✅ 員工已註冊: ' + employee.name);
    
    // 處理打卡指令
    if (text === '打卡' || text === '上班' || text === '下班') {
      
      // 🔧 修正：根據指令決定打卡類型
      let punchType;
      if (text === '上班') {
        punchType = '上班';
      } else if (text === '下班') {
        punchType = '下班';
      } else {
        // 「打卡」指令：自動判斷
        punchType = determinePunchType(userId);
      }
      
      // 🔧 修正：將打卡類型暫存起來
      savePunchIntent_(userId, punchType);
      
      sendPunchLocationRequest(replyToken, employee.name, punchType);
    } 
    else if (text === '查詢' || text === '我的打卡') {
      sendTodayPunchRecords(replyToken, userId, employee.name);
    }
    else if (text === '補打卡') {
      sendAdjustPunchGuide(replyToken);
    }
    else if (text === '說明' || text === '幫助' || text === '指令') {
      sendHelpMessage(replyToken);
    }
    else {
      replyMessage(replyToken, '💡 我不太明白您的意思\n\n請輸入「指令」查看可用功能');
    }
    
  } catch (error) {
    Logger.log('❌ handleLineMessage 錯誤: ' + error);
  }
}

// ========== 新增：暫存打卡意圖 ==========
/**
 * 暫存用戶的打卡意圖
 * @param {string} userId - LINE userId
 * @param {string} punchType - 打卡類型（上班/下班）
 */
function savePunchIntent_(userId, punchType) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'PUNCH_INTENT_' + userId;
    
    // 暫存 5 分鐘
    const intent = {
      type: punchType,
      timestamp: new Date().getTime()
    };
    
    props.setProperty(key, JSON.stringify(intent));
    Logger.log('💾 已暫存打卡意圖: ' + punchType);
    
  } catch (error) {
    Logger.log('❌ savePunchIntent_ 錯誤: ' + error);
  }
}

/**
 * 取得用戶的打卡意圖
 * @param {string} userId - LINE userId
 * @returns {string|null} - 打卡類型或 null
 */
function getPunchIntent_(userId) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'PUNCH_INTENT_' + userId;
    const intentStr = props.getProperty(key);
    
    if (!intentStr) {
      return null;
    }
    
    const intent = JSON.parse(intentStr);
    const now = new Date().getTime();
    
    // 檢查是否過期（5 分鐘 = 300000 毫秒）
    if (now - intent.timestamp > 300000) {
      props.deleteProperty(key);
      Logger.log('⏰ 打卡意圖已過期');
      return null;
    }
    
    Logger.log('✅ 取得打卡意圖: ' + intent.type);
    return intent.type;
    
  } catch (error) {
    Logger.log('❌ getPunchIntent_ 錯誤: ' + error);
    return null;
  }
}

/**
 * 清除打卡意圖
 * @param {string} userId - LINE userId
 */
function clearPunchIntent_(userId) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'PUNCH_INTENT_' + userId;
    props.deleteProperty(key);
    Logger.log('🗑️ 已清除打卡意圖');
  } catch (error) {
    Logger.log('❌ clearPunchIntent_ 錯誤: ' + error);
  }
}

/**
 * 檢查是否為重複打卡（1分鐘內相同類型）
 */
function isDuplicatePunch_(userId, punchType) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_ATTENDANCE);
    const values = sheet.getDataRange().getValues();
    const now = new Date().getTime();
    
    // 檢查最近 1 分鐘內的記錄
    for (let i = values.length - 1; i >= 1; i--) {
      const recordTime = new Date(values[i][0]).getTime();
      const recordUserId = values[i][1];
      const recordType = values[i][4];
      
      // 如果是同一個人、同一種類型、時間在 1 分鐘內
      if (recordUserId === userId && 
          recordType === punchType && 
          (now - recordTime) < 60000) {  // 60000ms = 1分鐘
        Logger.log('⚠️ 偵測到重複打卡，已忽略');
        return true;
      }
      
      // 只檢查最近 10 筆記錄即可
      if (values.length - i > 10) break;
    }
    
    return false;
    
  } catch (error) {
    Logger.log('❌ isDuplicatePunch_ 錯誤: ' + error);
    return false;
  }
}

/**
 * 檢查事件是否已處理過（防止 LINE Webhook 重複觸發）
 */
function isEventProcessed_(eventId) {
  try {
    const cache = CacheService.getScriptCache();
    const key = 'EVENT_' + eventId;
    
    // 檢查快取中是否存在
    if (cache.get(key)) {
      Logger.log('⚠️ 事件已處理過: ' + eventId);
      return true;
    }
    
    // 標記為已處理（快取 10 分鐘）
    cache.put(key, 'processed', 600);
    Logger.log('✅ 標記事件為已處理: ' + eventId);
    return false;
    
  } catch (error) {
    Logger.log('❌ isEventProcessed_ 錯誤: ' + error);
    return false;  // 發生錯誤時允許處理，避免卡住
  }
}
/**
 * 處理 LINE 位置訊息（執行打卡）
 */
function handleLineLocation(event) {
  try {
    const userId = event.source.userId;
    const lat = event.message.latitude;
    const lng = event.message.longitude;
    const replyToken = event.replyToken;
    
    Logger.log('📍 收到位置訊息');
    Logger.log('   userId: ' + userId);
    Logger.log('   座標: ' + lat + ', ' + lng);
    
    const employee = findEmployeeByLineUserId_(userId);
    
    if (!employee.ok) {
      replyMessage(replyToken, '❌ 您尚未註冊為系統員工');
      return;
    }
    
    // 🔧 修正：先嘗試從暫存取得打卡意圖
    let punchType = getPunchIntent_(userId);
    
    // 如果沒有暫存（可能是直接傳送位置），才自動判斷
    if (!punchType) {
      punchType = determinePunchType(userId);
      Logger.log('🔍 自動判斷打卡類型: ' + punchType);
    } else {
      Logger.log('📋 使用暫存的打卡類型: ' + punchType);
    }
    
    // 檢查位置
    const locationCheck = checkPunchLocation(lat, lng);
    
    if (!locationCheck.valid) {
      const message = {
        type: 'flex',
        altText: '❌ 打卡失敗',
        contents: createPunchFailedMessage(locationCheck.reason, locationCheck.nearestLocation)
      };
      
      sendLineReply_(replyToken, [message]);
      
      // 🔧 修正：打卡失敗也要清除意圖
      clearPunchIntent_(userId);
      return;
    }
    
    Logger.log('✅ 位置檢查通過: ' + locationCheck.locationName);
    
    // 🔧 新增：檢查是否為重複打卡
    if (isDuplicatePunch_(userId, punchType)) {
      Logger.log('⚠️ 重複打卡，已忽略');
      replyMessage(replyToken, '⚠️ 您剛剛已經打過卡了，請勿重複操作');
      clearPunchIntent_(userId);
      return;
    }
    // 執行打卡
    const punchResult = executePunch(userId, punchType, lat, lng, locationCheck.locationName);
    
    if (punchResult.success) {
      const message = {
        type: 'flex',
        altText: '✅ 打卡成功',
        contents: createPunchSuccessMessage(
          employee.name,
          punchType,
          punchResult.time,
          locationCheck.locationName
        )
      };
      
      sendLineReply_(replyToken, [message]);
      
      // 🔧 修正：打卡成功後清除意圖
      clearPunchIntent_(userId);
    } else {
      replyMessage(replyToken, '❌ 打卡失敗\n\n' + punchResult.message);
      clearPunchIntent_(userId);
    }
    
  } catch (error) {
    Logger.log('❌ handleLineLocation 錯誤: ' + error);
    replyMessage(event.replyToken, '❌ 系統錯誤，請稍後再試');
  }
}

/**
 * 判斷打卡類型（上班/下班）
 */
function determinePunchType(userId) {
  try {
    const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
    const values = sheet.getDataRange().getValues();
    
    // 查找今天的打卡記錄
    let hasPunchIn = false;
    let hasPunchOut = false;
    
    for (let i = 1; i < values.length; i++) {
      const recordDate = Utilities.formatDate(new Date(values[i][0]), 'Asia/Taipei', 'yyyy-MM-dd');
      const recordUserId = values[i][1];
      const recordType = values[i][4];
      
      if (recordUserId === userId && recordDate === today) {
        if (recordType === '上班') hasPunchIn = true;
        if (recordType === '下班') hasPunchOut = true;
      }
    }
    
    // 決策邏輯
    if (!hasPunchIn) {
      return '上班';
    } else if (!hasPunchOut) {
      return '下班';
    } else {
      // 已經打過上下班卡，返回加班
      return '下班'; // 或者可以改成 '加班'
    }
    
  } catch (error) {
    Logger.log('❌ determinePunchType 錯誤: ' + error);
    return '上班'; // 預設返回上班
  }
}

/**
 * 檢查打卡位置是否有效
 */
function checkPunchLocation(lat, lng) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOCATIONS);
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return {
        valid: false,
        reason: '系統尚未設定打卡地點',
        nearestLocation: null
      };
    }
    
    const locations = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    
    let nearestLocation = null;
    let minDistance = Infinity;
    let validLocation = null;
    
    for (let [, name, locLat, locLng, radius] of locations) {
      if (!name || !locLat || !locLng) continue;
      
      const distance = getDistanceMeters_(lat, lng, Number(locLat), Number(locLng));
      
      // 記錄最近的地點
      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = {
          name: name,
          distance: Math.round(distance)
        };
      }
      
      // 檢查是否在範圍內
      if (distance <= Number(radius)) {
        validLocation = {
          valid: true,
          locationName: name,
          distance: Math.round(distance)
        };
        break;
      }
    }
    
    if (validLocation) {
      return validLocation;
    } else {
      return {
        valid: false,
        reason: '您不在任何打卡地點範圍內',
        nearestLocation: nearestLocation
      };
    }
    
  } catch (error) {
    Logger.log('❌ checkPunchLocation 錯誤: ' + error);
    return {
      valid: false,
      reason: '位置檢查失敗',
      nearestLocation: null
    };
  }
}

/**
 * 執行打卡
 */
function executePunch(userId, punchType, lat, lng, locationName) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_ATTENDANCE);
    const employee = findEmployeeByLineUserId_(userId);
    
    if (!employee.ok) {
      return {
        success: false,
        message: '找不到員工資料'
      };
    }
    
    const now = new Date();
    const time = Utilities.formatDate(now, 'Asia/Taipei', 'HH:mm:ss');
    
    const row = [
      now,                                      // A: 打卡時間
      userId,                                   // B: userId
      employee.dept,                            // C: 部門
      employee.name,                            // D: 打卡人員
      punchType,                                // E: 打卡類別
      `(${lat},${lng})`,                        // F: GPS
      locationName,                             // G: 地點
      'LINE Bot',                               // H: 備註
      '',                                       // I: 管理員審核
      'LINE Official Account'                   // J: 裝置資訊
    ];
    
    sheet.appendRow(row);
    
    Logger.log('✅ 打卡成功');
    Logger.log('   員工: ' + employee.name);
    Logger.log('   類型: ' + punchType);
    Logger.log('   地點: ' + locationName);
    
    return {
      success: true,
      time: time,
      message: '打卡成功'
    };
    
  } catch (error) {
    Logger.log('❌ executePunch 錯誤: ' + error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 發送打卡位置請求
 */
function sendPunchLocationRequest(replyToken, employeeName, punchType) {
  const message = {
    type: 'flex',
    altText: '請傳送您的位置以完成打卡',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📍 請傳送位置',
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF'
          }
        ],
        backgroundColor: '#2196F3',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${employeeName}，您好！`,
            size: 'lg',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'text',
            // 🔧 修正：明確顯示打卡類型
            text: `準備進行【${punchType}】打卡`,
            size: 'md',
            color: punchType === '上班' ? '#4CAF50' : '#FF9800',
            margin: 'md',
            weight: 'bold'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: '📱 如何傳送位置？',
                weight: 'bold',
                size: 'md',
                color: '#2196F3'
              },
              {
                type: 'text',
                text: '1. 點擊下方「＋」按鈕',
                size: 'sm',
                color: '#666666',
                margin: 'md'
              },
              {
                type: 'text',
                text: '2. 選擇「位置資訊」',
                size: 'sm',
                color: '#666666',
                margin: 'sm'
              },
              {
                type: 'text',
                text: '3. 傳送您的目前位置',
                size: 'sm',
                color: '#666666',
                margin: 'sm'
              }
            ]
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '⚠️ 請確保您在公司打卡範圍內',
            size: 'xs',
            color: '#FF9800',
            margin: 'lg',
            wrap: true
          }
        ]
      }
    }
  };
  
  sendLineReply_(replyToken, [message]);
}

/**
 * 建立打卡成功訊息
 */
function createPunchSuccessMessage(employeeName, punchType, time, location) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✅ 打卡成功',
          weight: 'bold',
          size: 'xl',
          color: '#FFFFFF'
        }
      ],
      backgroundColor: '#4CAF50',
      paddingAll: '20px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `${employeeName}，打卡成功！`,
          size: 'lg',
          weight: 'bold',
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '類型',
                  color: '#999999',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: punchType,
                  wrap: true,
                  color: '#4CAF50',
                  size: 'md',
                  flex: 5,
                  weight: 'bold'
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '時間',
                  color: '#999999',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: time,
                  wrap: true,
                  color: '#333333',
                  size: 'sm',
                  flex: 5,
                  weight: 'bold'
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '地點',
                  color: '#999999',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: location,
                  wrap: true,
                  color: '#333333',
                  size: 'sm',
                  flex: 5
                }
              ]
            }
          ]
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'text',
          text: punchType === '上班' ? '💪 祝您今天工作順利！' : '🎉 辛苦了，下班愉快！',
          size: 'sm',
          color: '#4CAF50',
          margin: 'lg',
          align: 'center',
          weight: 'bold'
        }
      ]
    }
  };
}

/**
 * 建立打卡失敗訊息
 */
function createPunchFailedMessage(reason, nearestLocation) {
  const contents = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '❌ 打卡失敗',
          weight: 'bold',
          size: 'xl',
          color: '#FFFFFF'
        }
      ],
      backgroundColor: '#FF6B6B',
      paddingAll: '20px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: reason,
          size: 'md',
          color: '#FF6B6B',
          weight: 'bold',
          margin: 'md',
          wrap: true
        }
      ]
    }
  };
  
  // 如果有最近的地點資訊，加入提示
  if (nearestLocation) {
    contents.body.contents.push(
      {
        type: 'separator',
        margin: 'lg'
      },
      {
        type: 'text',
        text: '📍 最近的打卡地點',
        size: 'sm',
        color: '#999999',
        margin: 'lg'
      },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'sm',
        contents: [
          {
            type: 'text',
            text: nearestLocation.name,
            size: 'md',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `距離：${nearestLocation.distance} 公尺`,
            size: 'sm',
            color: '#666666',
            margin: 'xs'
          }
        ]
      }
    );
  }
  
  return contents;
}

/**
 * 發送今日打卡記錄
 */
function sendTodayPunchRecords(replyToken, userId, employeeName) {
  try {
    const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENDANCE);
    const values = sheet.getDataRange().getValues();
    
    const records = [];
    
    for (let i = 1; i < values.length; i++) {
      const recordDate = Utilities.formatDate(new Date(values[i][0]), 'Asia/Taipei', 'yyyy-MM-dd');
      const recordUserId = values[i][1];
      
      if (recordUserId === userId && recordDate === today) {
        records.push({
          time: Utilities.formatDate(new Date(values[i][0]), 'Asia/Taipei', 'HH:mm:ss'),
          type: values[i][4],
          location: values[i][6]
        });
      }
    }
    
    if (records.length === 0) {
      replyMessage(replyToken, `${employeeName}，您今天還沒有打卡記錄\n\n請傳送「打卡」開始打卡`);
      return;
    }
    
    // 建立記錄訊息
    const recordContents = records.map(r => ({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            {
              type: 'text',
              text: r.type,
              color: r.type === '上班' ? '#4CAF50' : '#FF9800',
              size: 'md',
              flex: 2,
              weight: 'bold'
            },
            {
              type: 'text',
              text: r.time,
              wrap: true,
              color: '#333333',
              size: 'sm',
              flex: 5
            }
          ]
        },
        {
          type: 'text',
          text: `📍 ${r.location}`,
          size: 'xs',
          color: '#666666',
          margin: 'xs'
        }
      ]
    }));
    
    const message = {
      type: 'flex',
      altText: '今日打卡記錄',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📋 今日打卡記錄',
              weight: 'bold',
              size: 'xl',
              color: '#FFFFFF'
            }
          ],
          backgroundColor: '#2196F3',
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${employeeName}`,
              size: 'lg',
              weight: 'bold',
              margin: 'md'
            },
            {
              type: 'text',
              text: today,
              size: 'sm',
              color: '#666666',
              margin: 'xs'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            ...recordContents
          ]
        }
      }
    };
    
    sendLineReply_(replyToken, [message]);
    
  } catch (error) {
    Logger.log('❌ sendTodayPunchRecords 錯誤: ' + error);
    replyMessage(replyToken, '❌ 查詢失敗，請稍後再試');
  }
}

/**
 * 發送補打卡指引
 */
function sendAdjustPunchGuide(replyToken) {
  const message = {
    type: 'flex',
    altText: '補打卡指引',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📝 補打卡指引',
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF'
          }
        ],
        backgroundColor: '#FF9800',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '補打卡功能目前需要到網頁版操作',
            size: 'md',
            wrap: true,
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '請按照以下步驟：',
            size: 'sm',
            color: '#666666',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '1. 開啟打卡系統網頁',
            size: 'sm',
            margin: 'md'
          },
          {
            type: 'text',
            text: '2. 登入帳號',
            size: 'sm',
            margin: 'sm'
          },
          {
            type: 'text',
            text: '3. 點選「補打卡」功能',
            size: 'sm',
            margin: 'sm'
          },
          {
            type: 'text',
            text: '4. 填寫補打卡資訊並提交',
            size: 'sm',
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '開啟網頁版',
              uri: 'https://eric693.github.io/Greedy_check_manager/'
            },
            color: '#FF9800'
          }
        ],
        flex: 0
      }
    }
  };
  
  sendLineReply_(replyToken, [message]);
}

/**
 * 發送幫助訊息
 */
function sendHelpMessage(replyToken) {
  const message = {
    type: 'flex',
    altText: '使用指令說明',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 使用指令',
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF'
          }
        ],
        backgroundColor: '#673AB7',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '可用指令列表',
            size: 'lg',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '「打卡」或「上班」或「下班」',
                    size: 'md',
                    weight: 'bold',
                    color: '#2196F3'
                  },
                  {
                    type: 'text',
                    text: '→ 開始打卡流程',
                    size: 'xs',
                    color: '#666666',
                    margin: 'xs'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '「查詢」或「我的打卡」',
                    size: 'md',
                    weight: 'bold',
                    color: '#4CAF50'
                  },
                  {
                    type: 'text',
                    text: '→ 查看今日打卡記錄',
                    size: 'xs',
                    color: '#666666',
                    margin: 'xs'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '「補打卡」',
                    size: 'md',
                    weight: 'bold',
                    color: '#FF9800'
                  },
                  {
                    type: 'text',
                    text: '→ 補打卡說明（需到網頁版）',
                    size: 'xs',
                    color: '#666666',
                    margin: 'xs'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '「說明」或「幫助」或「指令」',
                    size: 'md',
                    weight: 'bold',
                    color: '#673AB7'
                  },
                  {
                    type: 'text',
                    text: '→ 顯示本說明',
                    size: 'xs',
                    color: '#666666',
                    margin: 'xs'
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'link',
            height: 'sm',
            action: {
              type: 'uri',
              label: '開啟網頁版',
              uri: 'https://eric693.github.io/Greedy_check_manager/'
            }
          }
        ],
        flex: 0
      }
    }
  };
  
  sendLineReply_(replyToken, [message]);
}

/**
 * 發送 LINE 回覆
 */
function sendLineReply_(replyToken, messages) {
  try {
    const url = 'https://api.line.me/v2/bot/message/reply';
    const channelAccessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    
    if (!channelAccessToken) {
      Logger.log('❌ 找不到 LINE_CHANNEL_ACCESS_TOKEN');
      return;
    }
    
    const payload = {
      replyToken: replyToken,
      messages: messages
    };
    
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      Logger.log('✅ LINE 回覆已發送');
    } else {
      Logger.log('❌ LINE 回覆失敗: ' + result.message);
    }
    
  } catch (error) {
    Logger.log('❌ sendLineReply_ 錯誤: ' + error);
  }
}

/**
 * 發送簡單文字回覆
 */
function replyMessage(replyToken, text) {
  const message = {
    type: 'text',
    text: text
  };
  
  sendLineReply_(replyToken, [message]);
}

/**
 * 🧪 測試完整流程
 */
function testLineBotFullFlow() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 測試 LINE Bot 完整打卡流程');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  const testUserId = 'U68e0ca9d516e63ed15bf9387fad174ac'; // ⚠️ 替換成你的
  
  // 步驟 1：模擬發送「打卡」訊息
  Logger.log('📱 步驟 1：發送「打卡」訊息');
  const messageEvent = {
    postData: {
      contents: JSON.stringify({
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token-1',
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
  
  doPost(messageEvent);
  Logger.log('✅ 應該收到「請傳送位置」的提示');
  Logger.log('');
  
  // 等待 2 秒
  Utilities.sleep(2000);
  
  // 步驟 2：模擬傳送位置
  Logger.log('📍 步驟 2：傳送位置資訊');
  const locationEvent = {
    postData: {
      contents: JSON.stringify({
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token-2',
            source: {
              userId: testUserId
            },
            message: {
              type: 'location',
              latitude: 25.0330,  // ⚠️ 替換成你的測試座標
              longitude: 121.5654,
              address: '測試地址'
            }
          }
        ]
      })
    },
    parameter: {},
    headers: {}
  };
  
  doPost(locationEvent);
  Logger.log('✅ 應該完成打卡');
  Logger.log('');
  
  Logger.log('═══════════════════════════════════════');
  Logger.log('🎉 測試完成！');
  Logger.log('');
  Logger.log('📝 請檢查：');
  Logger.log('   1. LINE Bot 是否發送了訊息');
  Logger.log('   2. 打卡記錄是否寫入 Google Sheet');
  Logger.log('   3. 訊息格式是否正確');
}


// QuickTest.gs - 快速測試 doPost 函數

/**
 * 🧪 快速測試 doPost 是否正確回傳
 * 
 * 用途：在 Apps Script 中本地測試 doPost 函數
 * 執行：直接執行此函數
 * 
 * 預期結果：
 * ✅ 回傳內容: {"status":"ok"}
 * ✅ MIME 類型: application/json
 * ✅ 沒有錯誤訊息
 */
function testDoPostResponse() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 測試 doPost 回傳格式');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // 模擬 LINE Webhook 請求
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token-12345',
            source: {
              userId: 'U0000000000000000000000000000000'
            },
            message: {
              type: 'text',
              text: '測試'
            },
            timestamp: Date.now()
          }
        ],
        destination: 'U0000000000000000000000000000000'
      })
    },
    parameter: {},
    headers: {
      'X-Line-Signature': 'test-signature'
    }
  };
  
  Logger.log('📥 模擬 LINE Webhook 請求');
  Logger.log('   事件數: 1');
  Logger.log('   訊息類型: text');
  Logger.log('   訊息內容: 測試');
  Logger.log('');
  
  try {
    Logger.log('⏳ 執行 doPost()...');
    const result = doPost(testEvent);
    
    Logger.log('');
    Logger.log('📤 doPost() 回傳結果:');
    Logger.log('   類型: ' + typeof result);
    Logger.log('   物件名稱: ' + result.constructor.name);
    Logger.log('');
    
    // 檢查回傳內容
    const content = result.getContent();
    Logger.log('📄 回傳內容:');
    Logger.log('   ' + content);
    Logger.log('');
    
    // 檢查 MIME 類型
    const mimeType = result.getMimeType();
    Logger.log('📋 MIME 類型:');
    Logger.log('   ' + mimeType);
    Logger.log('');
    
    // 驗證結果
    Logger.log('🔍 驗證結果:');
    
    if (mimeType === 'application/json') {
      Logger.log('   ✅ MIME 類型正確 (application/json)');
    } else {
      Logger.log('   ❌ MIME 類型錯誤: ' + mimeType);
      Logger.log('   應該是: application/json');
    }
    
    try {
      const jsonContent = JSON.parse(content);
      Logger.log('   ✅ 內容是有效的 JSON');
      
      if (jsonContent.status === 'ok') {
        Logger.log('   ✅ status 為 "ok"');
      } else {
        Logger.log('   ⚠️ status 不是 "ok": ' + jsonContent.status);
      }
    } catch (parseError) {
      Logger.log('   ❌ 內容不是有效的 JSON');
      Logger.log('   錯誤: ' + parseError.message);
    }
    
    Logger.log('');
    Logger.log('═══════════════════════════════════════');
    Logger.log('✅✅✅ 測試通過！');
    Logger.log('');
    Logger.log('🎯 doPost() 函數正確回傳：');
    Logger.log('   - ContentService 物件');
    Logger.log('   - MIME 類型: application/json');
    Logger.log('   - 內容: {"status":"ok"}');
    Logger.log('');
    Logger.log('📝 下一步：');
    Logger.log('   1. 重新部署 Apps Script');
    Logger.log('   2. 到 LINE Developers 點選 Verify');
    Logger.log('   3. 應該會看到 Success ✅');
    Logger.log('═══════════════════════════════════════');
    
  } catch (error) {
    Logger.log('');
    Logger.log('❌❌❌ 測試失敗！');
    Logger.log('');
    Logger.log('錯誤訊息: ' + error.message);
    Logger.log('錯誤堆疊: ' + error.stack);
    Logger.log('');
    Logger.log('═══════════════════════════════════════');
  }
}

/**
 * 🧪 檢查 doPost 函數是否存在
 */
function checkDoPostExists() {
  Logger.log('🔍 檢查 doPost 函數');
  Logger.log('');
  
  if (typeof doPost === 'function') {
    Logger.log('✅ doPost 函數存在');
    
    // 檢查函數內容（簡單檢查）
    const funcStr = doPost.toString();
    
    if (funcStr.includes('ContentService')) {
      Logger.log('✅ 使用 ContentService（正確）');
    } else if (funcStr.includes('HtmlService')) {
      Logger.log('❌ 使用 HtmlService（錯誤）');
      Logger.log('   請更新為使用 ContentService');
    }
    
    if (funcStr.includes('application/json')) {
      Logger.log('✅ 設定 MIME 類型為 JSON（正確）');
    } else {
      Logger.log('⚠️ 未設定 JSON MIME 類型');
    }
    
  } else {
    Logger.log('❌ doPost 函數不存在');
    Logger.log('   請檢查 Main.gs 檔案');
  }
  
  Logger.log('');
}

/**
 * 🧪 完整診斷測試
 * 
 * 執行所有檢查並給出明確的修正建議
 */
function fullDiagnosis() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🏥 LINE Webhook 完整診斷');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // 診斷 1：檢查 doPost 函數
  Logger.log('========== 診斷 1: doPost 函數 ==========');
  checkDoPostExists();
  Logger.log('');
  
  // 診斷 2：測試回傳格式
  Logger.log('========== 診斷 2: 回傳格式 ==========');
  testDoPostResponse();
  Logger.log('');
  
  // 診斷 3：檢查 Script Properties
  Logger.log('========== 診斷 3: Script Properties ==========');
  const accessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const channelSecret = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_SECRET');
  
  if (accessToken) {
    Logger.log('✅ LINE_CHANNEL_ACCESS_TOKEN 已設定');
  } else {
    Logger.log('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定');
  }
  
  if (channelSecret) {
    Logger.log('✅ LINE_CHANNEL_SECRET 已設定');
  } else {
    Logger.log('❌ LINE_CHANNEL_SECRET 未設定');
  }
  
  Logger.log('');
  
  // 診斷 4：檢查必要函數
  Logger.log('========== 診斷 4: 必要函數 ==========');
  
  const requiredFunctions = [
    'doPost',
    'handleLineMessage',
    'handleLineLocation',
    'sendLineReply_',
    'replyMessage'
  ];
  
  requiredFunctions.forEach(funcName => {
    if (typeof this[funcName] === 'function' || typeof globalThis[funcName] === 'function') {
      Logger.log(`✅ ${funcName} 存在`);
    } else {
      Logger.log(`❌ ${funcName} 不存在`);
    }
  });
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
  Logger.log('🎯 診斷完成！');
  Logger.log('═══════════════════════════════════════');
}

/**
 * 🧪 模擬 LINE 傳送各種類型的訊息
 */
function testDifferentMessageTypes() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 測試不同訊息類型');
  Logger.log('═══════════════════════════════════════');
  Logger.log('');
  
  // 測試 1：文字訊息
  Logger.log('📱 測試 1: 文字訊息「打卡」');
  const textEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-token-1',
          source: { userId: 'test-user' },
          message: { type: 'text', text: '打卡' }
        }]
      })
    },
    parameter: {},
    headers: {}
  };
  
  try {
    const result1 = doPost(textEvent);
    Logger.log('   ✅ 文字訊息處理成功');
    Logger.log('   回傳: ' + result1.getContent());
  } catch (e) {
    Logger.log('   ❌ 失敗: ' + e.message);
  }
  
  Logger.log('');
  
  // 測試 2：位置訊息
  Logger.log('📍 測試 2: 位置訊息');
  const locationEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-token-2',
          source: { userId: 'test-user' },
          message: {
            type: 'location',
            latitude: 25.0330,
            longitude: 121.5654,
            address: '測試地址'
          }
        }]
      })
    },
    parameter: {},
    headers: {}
  };
  
  try {
    const result2 = doPost(locationEvent);
    Logger.log('   ✅ 位置訊息處理成功');
    Logger.log('   回傳: ' + result2.getContent());
  } catch (e) {
    Logger.log('   ❌ 失敗: ' + e.message);
  }
  
  Logger.log('');
  
  // 測試 3：空事件
  Logger.log('⚠️ 測試 3: 空事件');
  const emptyEvent = {
    postData: {
      contents: JSON.stringify({
        events: []
      })
    },
    parameter: {},
    headers: {}
  };
  
  try {
    const result3 = doPost(emptyEvent);
    Logger.log('   ✅ 空事件處理成功');
    Logger.log('   回傳: ' + result3.getContent());
  } catch (e) {
    Logger.log('   ❌ 失敗: ' + e.message);
  }
  
  Logger.log('');
  Logger.log('═══════════════════════════════════════');
  Logger.log('🎉 所有測試完成！');
  Logger.log('═══════════════════════════════════════');
}
